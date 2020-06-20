'use strict';

const { puyoImgs } = require('./panels.js');
const { setCreateRoomTrigger } = require('./panels.js');
const { showDialog } = require('./dialog.js');

const playerList = document.getElementById('playerList');
const messageList = document.getElementById('chatMessages');
let messageId = 0;
let lastSender = null;

function mainpageInit(playerInfo) {
	const { socket, gameId } = playerInfo;

	const sendMessageField = document.getElementById('sendMessage');
	const messageField = document.getElementById('messageField');
	sendMessageField.addEventListener("submit", event => {
		event.preventDefault();		// Do not refresh the page

		// Send message and clear the input field
		socket.emit('sendMessage', gameId, messageField.value);
		messageField.value = '';
	});

	socket.on('sendMessage', (sender, message) => {
		addMessage(sender, message);
	});

	const modal = document.getElementById('modal-background');
	const cpuOptionsError = document.getElementById('cpuOptionsError');

	document.getElementById('manageCpus').onclick = function() {
		modal.style.display = 'block';
		cpuOptionsError.style.display = 'none';
		document.getElementById('cpuOptionsModal').style.display = 'block';
	};

	document.getElementById('cpuOptionsAdd').onclick = function() {
		// Add only up to roomsize (or 6)
		socket.emit('addCpu', gameId);
	};

	socket.on('addCpuReply', index => {
		if(index === -1) {
			// No space in room
			cpuOptionsError.style.display = 'block';
			cpuOptionsError.innerHTML = 'There is no more space in the room.';
			return;
		}
		// Turn on the cpu at the provided index
		document.getElementById('cpu' + (index + 1)).style.display = 'grid';
		cpuOptionsError.style.display = 'none';
	});

	document.getElementById('cpuOptionsRemove').onclick = function() {
		// Remove only if there are any CPUs
		socket.emit('removeCpu', gameId);
	};

	socket.on('removeCpuReply', index => {
		if(index === -1) {
			// No CPUs in room
			cpuOptionsError.style.display = 'block';
			cpuOptionsError.innerHTML = 'There no CPUs currently in the room.';
			return;
		}
		// Turn off the cpu at the provided index
		document.getElementById('cpu' + (index + 1)).style.display = 'none';
		cpuOptionsError.style.display = 'none';
	});

	document.getElementById('cpuOptionsSubmit').onclick = function() {
		const cpus = [];

		document.querySelectorAll('.aiOption').forEach(dropdown => {
			// Do not read from invisible options
			if(window.getComputedStyle(dropdown).getPropertyValue('display') === 'block') {
				cpus.push({ id: null, ai: dropdown.options[dropdown.selectedIndex].value });
			}
		});

		document.querySelectorAll('.cpuSpeedSlider').forEach((slider, index) => {
			// Do not read from invisible options
			if(window.getComputedStyle(slider).getPropertyValue('display') === 'block') {
				// Slider value is between 0 and 10, map to between 5000 and 0
				cpus[index].speed = (10 - slider.value) * 500;
			}
		});
		socket.emit('setCpus', { gameId, cpus });

		// Close the CPU options menu
		document.getElementById('cpuOptionsModal').style.display = 'none';
		modal.style.display = 'none';
	};

	document.getElementById('manageSettings').onclick = function() {
		modal.style.display = 'block';
		document.getElementById('createRoomModal').style.display = 'block';
		document.getElementById('createRoomSubmit').value = 'Save Settings';

		// Disable the roomsize options
		document.querySelectorAll('.numPlayerButton').forEach(element => {
			element.classList.add('disabled');
		});
		document.getElementById('5player').disabled = true;

		setCreateRoomTrigger('set');
	};

	document.getElementById('manageStartRoom').onclick = function() {
		socket.emit('startRoom', gameId);
	};

	socket.on('startFailure', () => {
		showDialog.startFailure();
	});

	document.getElementById('manageJoinLink').onclick = function() {
		socket.emit('requestJoinLink', gameId);
	};
}

/**
 * Adds a message to the chat box.
 */
function addMessage(sender, message) {
	if(lastSender === sender) {
		const element = document.getElementById('message' + (messageId - 1)).querySelector('.message');
		element.innerHTML += '<br>' + message;
	}
	else {
		const element = document.createElement('li');
		element.classList.add('chatMsg');
		element.id = 'message' + messageId;
		messageId++;

		const senderElement = document.createElement('span');
		senderElement.innerHTML = sender;
		lastSender = sender;
		senderElement.classList.add('senderName');
		element.appendChild(senderElement);

		const messageElement = document.createElement('span');
		messageElement.innerHTML = message;
		messageElement.classList.add('message');
		element.appendChild(messageElement);

		messageList.appendChild(element);
	}
	messageList.scrollTop = messageList.scrollHeight;		// automatically scroll to latest message
}

/**
 * Clears all messages from the chat.
 */
function clearMessages() {
	while(messageList.firstChild) {
		messageList.firstChild.remove();
	}
}

/**
 * Adds a player to the list of players.
 */
function addPlayer(name, rating = 1000) {
	const newPlayer = document.createElement('li');
	newPlayer.classList.add('playerIndividual');
	newPlayer.id = 'player' + name;

	const icon = document.createElement('img');
	icon.src = `images/modal_boxes/${puyoImgs[playerList.childElementCount % puyoImgs.length]}.png`;
	newPlayer.appendChild(icon);

	const playerName = document.createElement('span');
	playerName.innerHTML = name;
	newPlayer.appendChild(playerName);

	const playerRating = document.createElement('span');
	playerRating.innerHTML = rating;
	newPlayer.appendChild(playerRating);

	playerList.appendChild(newPlayer);
}

/**
 * Removes all players from the list of players.
 */
function clearPlayers() {
	while(playerList.firstChild) {
		playerList.firstChild.remove();
	}
}

/**
 * Updates the playerList to the current array.
 */
function updatePlayers(players) {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'block';
	players.forEach(id => {
		addPlayer(id);
	});
}

function hidePlayers() {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'none';
}

module.exports = {
	mainpageInit,
	addMessage,
	clearMessages,
	updatePlayers,
	hidePlayers
};
