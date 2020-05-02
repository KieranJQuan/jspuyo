'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { PlayerGame } = require('./PlayerGame.js');
const { Session } = require('./Session.js');
const { Utils, Settings, UserSettings } = require('./Utils.js');

const io = require('socket.io-client');

class PlayerInfo {
	constructor() {
		this.socket = io();
		this.gameId = null;

		// Send a registration request to the server to receive a gameId
		this.socket.emit('register');
		this.socket.on('getGameId', id => {
			this.gameId = id;
		});

		this.userSettings = new UserSettings();
	}

	ready() {
		const waitUntilReady = resolve => {
			if(this.gameId === null) {
				setTimeout(() => waitUntilReady(resolve), 20);
			}
			else {
				resolve();
			}
		};
		return new Promise(waitUntilReady);
	}
}

// Initialize session. This function is only run once.
(async function () {
	const playerInfo = new PlayerInfo();
	await playerInfo.ready();

	// Set up behaviour
	await init(playerInfo);

	// Check if a joinRoom link was used
	const urlParams = new URLSearchParams(window.location.search);
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	if(joinId !== null) {
		playerInfo.socket.emit('joinRoom', { gameId: playerInfo.gameId, joinId, spectate: false });
		console.log('Joining a room...');
	}
	else {
		playerInfo.socket.emit('freeForAll', { gameId: playerInfo.gameId });
	}
})();

/*----------------------------------------------------------*/

let currentlyExpandedPanel = null;
const createRoomOptionsStateDefault = {
	selectedMode: 'Tsu',
	selectedPlayers: '4player',
	numColours: 4,
	winCondition: 'FT 3'
};
let createRoomOptionsState = Utils.objectCopy(createRoomOptionsStateDefault);
let currentSession = null;

const panelDropdowns = {
	'queuePanel': ['freeForAll', 'ranked'],
	'customPanel': ['createRoom', 'joinRoom', 'spectate'],
	'singleplayerPanel': ['sprint', 'timeChallenge', 'cpu'],
	'profilePanel': ['settings', 'gallery']
};

const puyoImgs = ['puyo_red', 'puyo_blue', 'puyo_green', 'puyo_yellow', 'puyo_purple'];
const winConditions = ['FT 3', 'FT 5', 'FT 7'];

// Set up all the event listeners
function init(playerInfo) {
	const { socket, gameId, userSettings } = playerInfo;

	socket.on('roomUpdate', (allIds, roomSize, settingsString, quickPlay) => {
		clearModal();
		console.log('Current players: ' + JSON.stringify(allIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(allIds.length);

		if(quickPlay) {
			if (allIds.length === 1) {
				console.log('Waiting for more players to start...');
			}
			else {
				console.log('Game starting soon!');
			}
		}
		else {
			console.log('Room size: ' + (allIds.length) + '/' + roomSize + ' players');
		}
		console.log('Settings: ' + settingsString);
	});

	socket.on('start', (opponentIds, cpus, settingsString) => {
		clearModal();
		const cpuIds = cpus.map(cpu => cpu.gameId);
		const allOpponentIds = opponentIds.concat(cpuIds);
		const allIds = allOpponentIds.concat(gameId);
		const settings = Settings.fromString(settingsString);

		console.log('Game starting!');
		console.log('Opponents: ' + JSON.stringify(opponentIds) + ' CPUs: ' + JSON.stringify(cpuIds));

		// Adjust the number of boards drawn
		clearBoards();
		generateBoards(opponentIds.length + cpus.length + 1);

		// Set up the player's game
		const currentGame = new PlayerGame(gameId, allOpponentIds, socket, settings, userSettings);

		let boardDrawerCounter = 2;

		// Create the CPU games
		const cpuGames = cpus.map(cpu => {
			const { gameId, speed, ai } = cpu;
			const thisSocket = io();
			const thisOppIds = allIds.slice();
			// Remove the cpu player from list of ids
			thisOppIds.splice(allIds.indexOf(gameId), 1);

			const thisGame = new CpuGame(
				gameId,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				Cpu.fromString(ai, settings),
				Number(speed),
				settings,
				userSettings
			);

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, gameId, remove: false };
		});

		const finishCallback = function(endResult) {
			switch(endResult) {
				case 'Win':
					console.log('You win!');
					socket.emit('gameEnd', gameId);
					break;
				case 'Loss':
					console.log('You lose...');
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					console.log('Your opponent has disconnected. This match will be counted as a win.');
					socket.emit('gameEnd', gameId);
					break;
				case 'Disconnect':
					console.log('Disconnected from the previous game. That match will be counted as a loss.')
					socket.emit('gameOver', gameId);
					break;
			}
			currentSession = null;
		};

		// Create the session
		currentSession = new Session(currentGame, cpuGames, finishCallback);
		currentSession.run();
	});

	// Add onclick listener to each panel
	Object.keys(panelDropdowns).forEach(panelId => {
		document.getElementById(panelId).onclick = () => expand_dropdown(panelId);
	});

	// Only one modal element
	const modal = Array.from(document.getElementsByClassName('modal'))[0];

	// Set all close buttons to remove modals
	Array.from(document.getElementsByClassName('close')).forEach(close => {
		close.onclick = () => clearModal();
	})

	// Manage window onclick
	window.onclick = function(event) {
		if (event.target == modal) {
			clearModal();
		}
	}

	// Queue Panel
	document.getElementById('freeForAll').onclick = () => {
		stopCurrentSession();
		socket.emit('freeForAll', { gameId });
	}
	document.getElementById('ranked').onclick = () => {
		stopCurrentSession();
		socket.emit('ranked', { gameId });
	}

	// Custom - Create Room
	document.getElementById('createRoom').onclick = () => {
		stopCurrentSession();

		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomOptions').style.display = 'flex';

		// createRoomOptionsState = Utils.objectCopy(createRoomOptionsStateDefault);
	}
	document.getElementById('modeIcon').onclick = () => {
		switch(createRoomOptionsState.selectedMode) {
			case "Tsu":
				document.getElementById('modeIcon').src = "images/modal_boxes/Fever_icon.png";
				createRoomOptionsState.selectedMode = "Fever";
				break;
			case "Fever":
				document.getElementById('modeIcon').src = "images/modal_boxes/Tsu_icon.png";
				createRoomOptionsState.selectedMode = "Tsu";
				break;
		}
	}
	Array.from(document.getElementsByClassName('numPlayerButton')).forEach(element => {
		element.onclick = () => {
			const oldId = createRoomOptionsState.selectedPlayers;
			if(element.id !== oldId) {
				document.getElementById(oldId).classList.remove('selected');
				element.classList.add('selected');
				createRoomOptionsState.selectedPlayers = element.id;
			}
		}
	});
	document.getElementById('numColours').oninput = () => {
		let currentNumber = Number(document.getElementById('numColours').value) || 0;
		let lastNumber = createRoomOptionsState.numColours;
		const coloursSelected = document.getElementById('coloursSelected');

		if(currentNumber > 5) {
			currentNumber = 5;
		}
		else if(currentNumber < 0) {
			currentNumber = 0;
		}

		while(lastNumber < currentNumber) {
			const newImg = document.createElement('img');
			newImg.src = `images/modal_boxes/${puyoImgs[lastNumber]}.png`;
			coloursSelected.appendChild(newImg);
			lastNumber++;
		}

		while(lastNumber > currentNumber) {
			// Remove last child
			coloursSelected.removeChild(coloursSelected.children[coloursSelected.children.length - 1]);
			lastNumber--;
		}
		createRoomOptionsState.numColours = currentNumber;
	};
	const hardDropButton = document.getElementById('hardDrop');
	hardDropButton.onclick = () => {
		if(hardDropButton.value === "ON") {
			hardDropButton.classList.add('off');
			hardDropButton.value = "OFF";
			hardDropButton.classList.remove('on');
		}
		else {
			hardDropButton.classList.add('on');
			hardDropButton.value = "ON";
			hardDropButton.classList.remove('off');
		}
	}
	const winConditionButton = document.getElementById('winCondition');
	winConditionButton.onclick = () => {
		let currentIndex = winConditions.indexOf(winConditionButton.value);
		if(currentIndex === winConditions.length - 1) {
			currentIndex = 0;
		}
		else {
			currentIndex++;
		}
		winConditionButton.value = winConditions[currentIndex];
	}
	document.getElementById('createRoomSubmit').onclick = function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();

		let roomSize;
		if(createRoomOptionsState.selectedPlayers === '5player') {
			roomSize = Number(document.getElementById('5player').value);

			if(roomSize < 1) {
				roomSize = 1;
			}
		}
		else {
			roomSize = Number(createRoomOptionsState.selectedPlayers.charAt(0));
		}

		const settingsString = new Settings(
			createRoomOptionsState.selectedMode,
			Number(document.getElementById('gravity').value),
			Number(document.getElementById('numRows').value),
			Number(document.getElementById('numCols').value),
			Number(document.getElementById('softDrop').value),
			Number(document.getElementById('numColours').value),
			Number(document.getElementById('targetPoints').value),
			Number(document.getElementById('marginTime').value) * 1000,
			Number(document.getElementById('minChainLength').value)
		).toString();

		socket.emit('createRoom', { gameId, settingsString, roomSize });
	}
	socket.on('giveRoomId', id => {
		console.log('Other players can join this room by appending ?joinRoom=' + id);
	});

	// Custom - Join Room
	document.getElementById('joinRoom').onclick = () => {
		modal.style.display = 'block';
		document.getElementById('joinRoomModal').style.display = 'block';
	}
	document.getElementById('joinIdForm').onsubmit = function (event) {
		// Prevent submit button from refreshing the page
		event.preventDefault();
		const joinId = document.getElementById('joinId').value;

		stopCurrentSession();

		socket.emit('joinRoom', { gameId, joinId, spectate: false});
	}

	// Received when room cannot be joined
	socket.on('joinFailure', (errMessage) => {
		modal.style.display = 'block';

		document.getElementById('joinIdFormError').innerHTML = errMessage;

		// Make the element containing the error message  visible
		document.getElementById('joinIdFormError').style.display = 'block';
	});

	// Custom - Spectate
	document.getElementById('spectate').onclick = () => {
		stopCurrentSession();
		modal.style.display = 'block';
		// TODO: Create a menu to select games to spectate
	}

	// Singleplayer Panel
	document.getElementById('cpu').onclick = function() {
		// TODO: Add options for cpu games
		const roomSize = 2;
		const settingsString = new Settings().toString();
		const cpus = [
			{ id: null, speed: 100, ai: 'Test' }
		];

		stopCurrentSession();
		socket.emit('cpuMatch', { gameId, roomSize, settingsString, cpus });
	}
	return new Promise(resolve => resolve());
}

function stopCurrentSession() {
	if(currentSession !== null) {
		currentSession.stop();
	}
	clearBoards();
}

function clearModal() {
	const modal = Array.from(document.getElementsByClassName('modal'))[0];
	modal.style.display = "none";

	// Clear all modal content
	Array.from(document.getElementsByClassName('modal-content')).forEach(element => {
		element.style.display = 'none';
	});

	// Clear all error messages
	Array.from(document.getElementsByClassName('errorMsg')).forEach(element => {
		element.style.display = 'none';
	});
}

function generateBoards (size) {
	const playArea = document.getElementById('playArea');
	const firstRow = playArea.insertRow(-1);

	let runningId = 1;

	const createGameCanvas = function(id, row, size) {
		const board = row.insertCell(-1);
		const gameArea = document.createElement('div');
		gameArea.id = 'gameArea' + id;
		board.appendChild(gameArea);

		const nuisanceQueueArea = document.createElement('div');
		nuisanceQueueArea.id = 'nuisanceQueueArea' + id;
		gameArea.appendChild(nuisanceQueueArea);

		const nuisanceQueueCanvas = document.createElement('canvas');
		nuisanceQueueCanvas.id = 'nuisanceQueue' + id;
		nuisanceQueueCanvas.height = 45 * size;
		nuisanceQueueCanvas.width = 270 * size;
		nuisanceQueueCanvas.className = 'nuisanceQueue';
		nuisanceQueueArea.appendChild(nuisanceQueueCanvas);

		const centralArea = document.createElement('div');
		centralArea.id = 'centralArea' + id;
		gameArea.appendChild(centralArea);

		const boardCanvas = document.createElement('canvas');
		boardCanvas.id = 'board' + id;
		boardCanvas.height = 540 * size;
		boardCanvas.width = 270 * size;
		centralArea.appendChild(boardCanvas);

		const queueCanvas = document.createElement('canvas');
		queueCanvas.id = 'queue' + id;
		queueCanvas.height = 540 * size;
		queueCanvas.width = 72 * size;
		centralArea.appendChild(queueCanvas);

		const pointsArea = document.createElement('div');
		pointsArea.id = 'pointsArea' + id;
		pointsArea.className = 'pointsArea';
		gameArea.appendChild(pointsArea);

		const pointsDisplay = document.createElement('span');
		pointsDisplay.id = 'pointsDisplay' + id;
		pointsDisplay.className = 'pointsDisplay';
		pointsDisplay.innerHTML = '00000000';
		pointsArea.appendChild(pointsDisplay);

		return board;
	};

	let playerBoard = createGameCanvas(runningId, firstRow, 1);
	runningId++;

	// Set up the number of boards displayed
	if(size < 5) {
		for(let i = 0; i < size - 1; i++) {
			createGameCanvas(runningId, firstRow, 1);
			runningId++;
		}
	}
	else if (size < 10) {
		playerBoard.setAttribute('rowspan', '2');
		// Create a larger top row
		for(let i = 0; i < Math.ceil((size - 1) / 2); i++) {
			createGameCanvas(runningId, firstRow, 0.5);
			runningId++;
		}
		// And a smaller bottom row
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < Math.floor((size - 1) / 2); i++) {
			createGameCanvas(runningId, secondRow, 0.5);
			runningId++;
		}
		Array.from(document.getElementsByClassName('pointsDisplay')).forEach(element => {
			if(element.id === "pointsDisplay1") {
				return;
			}
			element.style.fontSize = "26";
			element.style.width = "50%";
		});
	}
	else {
		playerBoard.setAttribute('rowspan', '3');
		const minPerRow = Math.floor((size - 1) / 3);
		let extras = size - 1 - minPerRow * 3;
		// Spread rows over the first two rows
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, firstRow, 0.33);
			runningId++;
		}
		extras--;
		const secondRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow + (extras > 0 ? 1 : 0); i++) {
			createGameCanvas(runningId, secondRow, 0.33);
			runningId++;
		}
		// Do the final bottom row, guaranteed to be no extras
		const thirdRow = playArea.insertRow(-1);
		for(let i = 0; i < minPerRow; i++) {
			createGameCanvas(runningId, thirdRow, 0.33);
			runningId++;
		}
		Array.from(document.getElementsByClassName('pointsDisplay')).forEach(element => {
			if(element.id === "pointsDisplay1") {
				return;
			}
			element.style.fontSize = "16";
			element.style.width = "33%";
		});
	}
}

// Clears all boards on screen
function clearBoards() {
	const playArea = document.getElementById('playArea');
	while(playArea.firstChild) {
		playArea.firstChild.remove();
	}
}

/**
 * Expands a dropdown menu and closes any other open dropdown menu.
 * If the current dropdown menu is already open, it is closed.
 */
function expand_dropdown(id) {
	const panels = Object.keys(panelDropdowns);

	if(currentlyExpandedPanel === id) {
		document.getElementById(id).classList.remove('expanded');
		document.getElementById(id).querySelector('.dropdown').style.height = '0';
		currentlyExpandedPanel = null;
	}
	else {
		document.getElementById(id).querySelector('.dropdown').style.height = `${panelDropdowns[id].length * 40}`;
		document.getElementById(id).classList.add('expanded');
		document.getElementById(id).style.zIndex = '10';
		if(currentlyExpandedPanel !== null) {
			document.getElementById(currentlyExpandedPanel).classList.remove('expanded');
			document.getElementById(currentlyExpandedPanel).querySelector('.dropdown').style.height = '0';
		}
		currentlyExpandedPanel = id;
	}

	// Then set the z-index for each panel on selection for nice shadow cascading.
	let indexes;
	switch(id) {
		case panels[0]:
			indexes = [6, 5, 4, 3];
			break;
		case panels[1]:
			indexes = [5, 6, 4, 3];
			break;
		case panels[2]:
			indexes = [3, 4, 6, 5];
			break;
		case panels[3]:
			indexes = [3, 4, 5, 6];
			break;
	}
	panels.forEach((panel, i) => {
		document.getElementById(panel).style.zIndex = indexes[i];
	});
}