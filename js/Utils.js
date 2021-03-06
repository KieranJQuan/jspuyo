'use strict';
const DIMENSIONS = {	BOARD : { W: 270, H: 540 },
						QUEUE : { W: 72, H: 540 },
						NUISANCE_QUEUE : { W: 270, H: 45 },
						MARGIN: 10,
						MIN_SCALE: 0.5};

class Settings {
	constructor(gamemode = 'Tsu', gravity = 0.036, rows = 12, cols = 6, softDrop = 0.27, numColours = 4,
				targetPoints = 70, marginTime = 96000, minChain = 0, seed = Math.random()) {
		this.gamemode = gamemode;			// Type of game that is being played
		this.gravity = gravity;				// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.rows = rows;					// Number of rows in the game board
		this.cols = cols;					// Number of columns in the game board
		this.softDrop = softDrop;			// Additional vertical distance the drop falls when soft dropping
		this.numColours = numColours;		// Number of unique puyo colours being used
		this.targetPoints = targetPoints;	// Points required to send one nuisance puyo
		this.marginTime = marginTime;		// Milliseconds before target points start being reduced
		this.minChain = minChain;			// Minimum chain before nuisance is sent
		this.seed = seed;					// Seed for generating drops

		// Constants that cannot be modified
		this.lockDelay = 200;				// Milliseconds of time before a drop locks into place
		this.frames_per_rotation = 8;		// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;			// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.squishFrames = 8;				// Number of frames used for squishing a drop into the stack
		this.dropFrames = 10;				// Number of frames used for all the puyo to drop
		this.popFrames = 65;				// Number of frames used to pop any amount of puyos
		this.isoCascadeFramesPerRow	= 3.25;	// Number of frames used for an isolated puyo to fall one row
		this.meanNuisanceCascadeFPR = 3;	// Average frames used for nuisance to drop one row
		this.varNuisanceCascadeFPR = 0.3; 	// Max positive or negative difference in frames used for nuisance to drop one row
		this.nuisanceLandFrames = 4;		// Number of frames taken for the nuisance landing animation
		this.hashSnapFactor = 100;			// Fraction of a row rounded to when hashing
		this.hashRotFactor = 50;			// Fraction of a rev rounded to when hashing
		this.nuisanceSpawnRow = rows + 2;	// Row of nuisance spawn

		this.timer = Date.now();			// Timer for margin time
		this.marginTimeStarted = false;		// Flag for whether margin time has started
		this.reductions = 0;				// Number of target point reductions
	}

	toString() {
		return this.gamemode + ' '
			+ this.gravity + ' '
			+ this.rows + ' '
			+ this.cols + ' '
			+ this.softDrop + ' '
			+ this.numColours + ' '
			+ this.targetPoints + ' '
			+ this.marginTime + ' '
			+ this.minChain + ' '
			+ this.seed;
	}

	static fromString(str) {
		const parts = str.split(' ');
		const gamemode = parts.splice(0, 1)[0];
		const parsedParts = parts.map(part => Number(part));
		return new Settings(gamemode, ...parsedParts);
	}

	/**
	 * Updates the target points due to margin time.
	 */
	checkMarginTime(currentTime = Date.now()) {
		let timeElapsed = currentTime - this.timer;
		if(!this.marginTimeStarted) {
			if(timeElapsed > this.marginTime) {
				this.targetPoints = Math.floor(this.targetPoints * 0.75);
				this.reductions++;
				this.marginTimeStarted = true;
				timeElapsed -= this.marginTime;
				this.timer += this.marginTime;
			}
			else {
				// Not yet reached margin time
				return;
			}
		}
		while(timeElapsed > 16000 && this.targetPoints > 1 && this.reductions < 15) {
			this.targetPoints = Math.floor(this.targetPoints / 2);
			this.reductions++;
			timeElapsed -= 16000;
			this.timer += 16000;
		}
	}
}

const checkBetweenEq = function(value, min, max) {
	const number = Number(value);
	if(number && number >= min && number <= max) {
		return number;
	}
	return undefined;
};

const checkPositiveInteger = function(value) {
	const number = Number(value);
	if(number && number >= 1) {
		return Math.floor(number);
	}
	return undefined;
};

const checkNonnegativeDecimal = function(value) {
	const number = Number(value);
	if(number === 0 || (number && number > 0)) {
		return number;
	}
	return undefined;
};

class SettingsBuilder {
	constructor() {
		// no default constructor
	}

	setGamemode (gamemode) {		// specific values fixed by options
		this.gamemode = gamemode;

		return this;
	}

	setGravity (gravity) {
		this.gravity = checkNonnegativeDecimal(gravity);
		return this;
	}

	setRows (rows) {
		this.rows = checkBetweenEq(checkPositiveInteger(rows), 6, 100);
		return this;
	}

	setCols(cols) {
		this.cols = checkBetweenEq(checkPositiveInteger(cols), 3, 50);
		return this;
	}

	setSoftDrop (softDrop) {
		this.softDrop = checkNonnegativeDecimal(softDrop);
		return this;
	}

	setNumColours (numColours) {
		this.numColours = checkBetweenEq(checkPositiveInteger(numColours), 1, 6);
		return this;
	}

	setTargetPoints (targetPoints) {
		this.targetPoints = checkBetweenEq(checkPositiveInteger(targetPoints), 1, Infinity);
		return this;
	}

	setMarginTimeInSeconds (marginTime) {
		const value = Math.floor(checkNonnegativeDecimal(marginTime));
		if(value) {
			this.marginTime = value * 1000;
		}
		return this;
	}

	setMinChain (minChain) {
		this.minChain = Math.floor(checkNonnegativeDecimal(minChain));
		return this;
	}

	build () {
		return new Settings(this.gamemode, this.gravity, this.rows, this.cols, this.softDrop, this.numColours, this.targetPoints, this.marginTime, this.minChain);
	}
}

class UserSettings {
	constructor(das = 200, arr = 20, skipFrames = 0, sfxVolume = 0.1, musicVolume = 0.1, appearance = 'TsuClassic') {
		this.das = das;						// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;						// Milliseconds between event triggers after the DAS timer is complete
		this.skipFrames = skipFrames;		// Frames to skip when drawing opponent boards (improves performance)
		this.sfxVolume = sfxVolume;			// SFX Volume (varies between 0 and 1)
		this.musicVolume = musicVolume;		// Music Volume (varies between 0 and 1)
		this.appearance = appearance;

		this.keyBindings = {				// Default key bindings
			moveLeft: 'ArrowLeft',
			moveRight: 'ArrowRight',
			rotateCCW: 'KeyZ',
			rotateCW: 'KeyX',
			softDrop: 'ArrowDown',
			hardDrop: 'ArrowUp'
		};
	}

	set(key, value) {
		this[key] = value;
	}
}

const audioFilenames = {
	move: { numClips: 1 },
	rotate: { numClips: 1 },
	win: { numClips: 1 },
	loss: { numClips: 1 },
	chain: { numClips: 7, start: 1 },
	nuisance_send: { numClips: 4, start: 2 },
	nuisance_fall: { numClips: 2 },
	all_clear: { numClips: 1 }
};
const characterNames = ['akari'];

class AudioPlayer {
	constructor(gameId, socket, sfxVolume, musicVolume) {
		this.gameId = gameId;
		this.socket = socket;
		this.sfxVolume = sfxVolume;
		this.musicVolume = musicVolume;
		this.cancel = false;

		this.sfx = {};

		Object.keys(audioFilenames).forEach(name => {
			const audioInfo = audioFilenames[name];

			if(audioInfo.numClips === 1) {
				const audio = new Audio(`../sounds/${name}.wav`);
				audio.volume = this.sfxVolume * ((name === 'win' || name === 'lose') ? 0.6 : 1);
				this.sfx[name] = [audio];
			}
			else {
				const start = audioInfo.start || 0;
				const audioFiles = Array(start).fill(null);		// Fill array with null until start

				for(let i = 0; i < audioInfo.numClips; i++) {
					const audio = new Audio(`../sounds/${name}_${i + 1}.wav`);
					audio.volume = this.sfxVolume;
					audioFiles.push([audio]);
				}
				this.sfx[name] = audioFiles;
			}
		});

		this.voices = {};

		characterNames.forEach(name => {
			const chainAudio = [null];
			for(let i = 0; i < 13; i++) {
				const audio = new Audio(`../sounds/voices/${name}/chain_${i + 1}.ogg`);
				audio.volume = 0.3;
				chainAudio.push([audio]);
			}

			const spellAudio = [null];
			for(let i = 0; i < 5; i++) {
				const audio = new Audio(`../sounds/voices/${name}/spell_${i + 1}.ogg`);
				audio.volume = 0.3;
				spellAudio.push([audio]);
			}
			this.voices[name] = { chain: chainAudio, spell: spellAudio };
		});
	}

	/**
	 * Plays an audio clip. An 1-based index parameter is provided for more detailed selection.
	 */
	playAudio(audio) {
		let channel = 0;
		while(channel < audio.length && !audio[channel].paused) {
			channel++;
		}

		// Generate a new audio object
		if(channel === audio.length) {
			const newsfx = audio[channel - 1].cloneNode();
			newsfx.volume = audio[channel - 1].volume;
			audio.push(newsfx);
		}
		audio[channel].play();
	}

	playSfx(sfx_name, index = null) {
		if(this.cancel) {
			return;
		}
		const audio = (index === null) ? this.sfx[sfx_name] : this.sfx[sfx_name][index];
		this.playAudio(audio);
	}

	playVoice(character, audio_name, index = null) {
		if(this.cancel) {
			return;
		}
		const audio = (index === null) ? this.voices[character][audio_name] : this.voices[character][audio_name][index];
		this.playAudio(audio);
	}

	/**
	 * Plays a sound effect, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitSfx(sfx_name, index = null) {
		this.playSfx(sfx_name, index);
		this.socket.emit('sendSound', this.gameId, sfx_name, index);
	}

	/**
	 * Plays a voiced audio clip, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitVoice(character, audio_name, index = null) {
		this.playVoice(character, audio_name, index);
		this.socket.emit('sendVoice', this.gameId, character, audio_name, index);
	}

	disable() {
		this.cancel = true;
	}
}

/**
 * Returns a random puyo colour, given the size of the colour pool.
 */
function getRandomColour (numColours) {
	return Math.floor(Math.random() * numColours) + 1;
}

/**
 * Returns the location(s) of the schezo puyo(s).
 *
 * Currently only works for I-shaped Drops (Tsu).
 */
function getOtherPuyo (drop) {
	let x = drop.arle.x + Math.cos(drop.standardAngle + Math.PI / 2);
	let y = drop.arle.y + Math.sin(drop.standardAngle + Math.PI / 2);

	// Perform integer rounding
	if(Math.abs(x - Math.round(x)) < 0.001) {
		x = Math.round(x);
	}
	if(Math.abs(y - Math.round(y)) < 0.001) {
		y = Math.round(y);
	}
	return { x, y };
}

/**
 * Gets the frames needed for the animation (accounts for falling time).
 */
function getDropFrames(poppingLocs, boardState, settings) {
	return poppingLocs.some(loc => {
		return boardState[loc.col][loc.row + 1] !== undefined && !poppingLocs.some(loc2 => loc2.col === loc.col && loc2.row === loc.row + 1);
	}) ? settings.dropFrames : 0;
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
function calculateScore (puyos, chain_length) {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [null, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [null, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [null, null, null, null, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyos.length;

	// Find the different colours
	const containedColours = {};

	puyos.forEach(puyo => {
		if(containedColours[puyo.colour] === undefined) {
			containedColours[puyo.colour] = 1;
		}
		else {
			containedColours[puyo.colour]++;
		}
	});

	// Chain power based on length of chain
	const chain_power = CHAIN_POWER[chain_length];

	// Colour bonus based on number of colours used
	const colour_bonus = COLOUR_BONUS[Object.keys(containedColours).length];

	// Group bonus based on number of puyos in each group
	const group_bonus = Object.keys(containedColours).reduce((bonus, colour) => bonus += GROUP_BONUS[containedColours[colour]], 0);

	return (10 * puyos_cleared) * (chain_power + colour_bonus + group_bonus);
}

/**
 * Finds the amount of nuisance generated from a particular increase in score.
 */
function calculateNuisance(chain_score, targetPoints, leftoverNuisance) {
	const nuisancePoints = chain_score / targetPoints + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}

/**
 * Deep copies an object where all values are primitype types.
 * Call this function recursively to deep copy more nested objects.
 */
function objectCopy(obj) {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Clamps a number between a minimum and maximum number.
 */
function clampBetween(value, min, max) {
	if(value < min) {
		return min;
	}
	else if(value > max) {
		return max;
	}
	return value;
}

const Utils = {
	getRandomColour,
	getOtherPuyo,
	getDropFrames,
	calculateScore,
	calculateNuisance,
	objectCopy,
	clampBetween
};

module.exports = {
	DIMENSIONS,
	Settings,
	SettingsBuilder,
	UserSettings,
	AudioPlayer,
	Utils
};
