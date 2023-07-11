/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Main app
/// 
/// <reference path='phaser-ts/phaser.d.ts'/>
/// <reference path='entities.ts'/>

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

var TILE_SIZE: number = 32;
var NUM_TILES: number = 22;		// in each dimension

//------------------------------------------------------------------------------

class ClockwiseGame extends Phaser.Game
{
	constructor()
	{
		super(TILE_SIZE * NUM_TILES, TILE_SIZE * NUM_TILES, Phaser.AUTO, 'content', {
			preload: () => { this._preload(); },
			create: () => { this._create() },
			update: () => { this._update(); }
		});
	}

	//------------------------------------------------------------------------------

	private _preload()
	{
		this.load.spritesheet('guy', 'data/tex/guy2-sheet.png', 32, 32);
		this.load.spritesheet('door', 'data/tex/door-sheet.png', 32, 32);
		this.load.spritesheet('gleam', 'data/tex/gleam-sheet.png', 16, 16);
		this.load.spritesheet('button', 'data/tex/button-sheet.png', 32, 32);
		this.load.image('background', 'data/tex/background.jpg');
		this.load.image('tiles', 'data/tex/tiles.png');
		this.load.image('pebble', 'data/tex/pebble.png');
		this.load.image('breakable', 'data/tex/breakable.png');
		this.load.image('rock', 'data/tex/rock.png');
		this.load.image('hole', 'data/tex/hole.png');
		this.load.image('key', 'data/tex/key.png');
		this.load.image('diamond', 'data/tex/diamond.png');
		this.load.image('water', 'data/tex/water.png');
		this.load.tilemap('map-top-left', 'data/map/top-left.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-top-right', 'data/map/top-right.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-bottom-left', 'data/map/bottom-left.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-bottom-right', 'data/map/bottom-right.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.audio('broke-wall', 'data/sfx/broke-wall.ogg', true);
		this.load.audio('charge', 'data/sfx/charge.ogg', true);
		this.load.audio('get-diamond', 'data/sfx/get-diamond.ogg', true);
		this.load.audio('get-key', 'data/sfx/get-key.ogg', true);
		this.load.audio('gravity', 'data/sfx/gravity.ogg', true);
		this.load.audio('open-door', 'data/sfx/open-door.ogg', true);
		this.load.audio('rock-in-hole', 'data/sfx/rock-in-hole.ogg', true);
	}

	//------------------------------------------------------------------------------

	private _create()
	{
		// Stop various key presses from passing through to the browser
		var keyboard = Phaser.Keyboard;
		this.input.keyboard.addKeyCapture([keyboard.LEFT, keyboard.RIGHT, keyboard.UP, keyboard.DOWN, keyboard.SPACEBAR, keyboard.BACKSPACE, keyboard.K]);

		this.physics.startSystem(Phaser.Physics.ARCADE);

		// Add game world space for camera shaking
		this.world.setBounds(-10, -10, this.width + 20, this.height + 20);

		this.add.sprite(32, 32, 'background');

		this.isRestarting = false;

		this.player = new PlayerEntity(32, 32);

		this.maps = {};
		var HALF_NUM_TILES = NUM_TILES / 2;
		var topLeft = new TileMapEntity('map-top-left', 'tiles', 0, 0, false);
		var topRight = new TileMapEntity('map-top-right', 'tiles', HALF_NUM_TILES, 0);
		var bottomRight = new TileMapEntity('map-bottom-right', 'tiles', HALF_NUM_TILES, HALF_NUM_TILES);
		var bottomLeft = new TileMapEntity('map-bottom-left', 'tiles', 0, HALF_NUM_TILES);
		topLeft.setRelatedMaps(topRight, bottomRight, bottomLeft);
		topRight.setRelatedMaps(bottomRight, bottomLeft, topLeft);
		bottomRight.setRelatedMaps(bottomLeft, topLeft, topRight);
		bottomLeft.setRelatedMaps(topLeft, topRight, bottomRight);
		this.maps['top-left'] = topLeft;
		this.maps['top-right'] = topRight;
		this.maps['bottom-right'] = bottomRight;
		this.maps['bottom-left'] = bottomLeft;
		// Workarounds :)
		bottomRight.ignoreFirstSwitch = true;
		bottomLeft.ignoreFirstSwitch = true;
		bottomRight.ignoreSwitchOnLastLayer = true;
		bottomLeft.ignoreSwitchOnLastLayer = true;
		this.setCurrentMap(topLeft);

		this.brokeWallSound = this.sound.add('broke-wall');
		this.chargeSound = this.sound.add('charge');
		this.getDiamondSound = this.sound.add('get-diamond');
		this.getKeySound = this.sound.add('get-key');
		this.gravitySound = this.sound.add('gravity');
		this.openDoorSound = this.sound.add('open-door');
		this.rockInHoleSound = this.sound.add('rock-in-hole');

		//this.fpsText = this.add.text(4, 4, "FPS: 0", { font: "24px Verdana,Helvetica,sans-serif" });
		this.time.advancedTiming = true;

		//this.time.events.loop(1000, () => this.fpsText.text = "FPS: " + this.time.fps, null);

		this.titleText = this.addCentredText(2, "Clockwise!");
	}

	//------------------------------------------------------------------------------

	private _update()
	{
		// Update all maps
		var currentLayers: TileMapLayerEntity[] = [];
		for (var key in this.maps)
		{
			var map = this.maps[key];
			map.update();
			if (map.isVisible)
				currentLayers.push(map.currentLayer);
		}

		// Apply all collisions within and between layers
		for (var layerIndex = 0; layerIndex < currentLayers.length; ++layerIndex)
		{
			var layer = currentLayers[layerIndex];
			layer.collideWithPlayer(this.player);
			layer.collideMobileObjectsTogether();

			// Collide layer's mobile objects with other layer (or the same layer, as we're checking walls)
			for (var otherLayerIndex = 0; otherLayerIndex < currentLayers.length; ++otherLayerIndex)
				layer.collideMobileObjectsWithLayer(currentLayers[otherLayerIndex]);
		}


		// Check for a restart room press
		if (!this.isRestarting)
		{
			if (this.input.keyboard.isDown(Phaser.Keyboard.BACKSPACE) && this.input.keyboard.isDown(Phaser.Keyboard.CONTROL))
			{
				this.isRestarting = true;
				for (var key in this.maps)
				{
					var map = this.maps[key];
					if (map.isVisible)
						map.fadeOut(null, (mapObj, tween) => this.resetLayer(mapObj));
				}
				this.player.fadeOut();
			}
			else
				this.player.update();
		}
	}

	//------------------------------------------------------------------------------

	public win()
	{
		this.changeCentredText(this.titleText, "Clockwise!");
		this.addCentredText(game.height / 2 + 12, "CONGRATULATIONS!");
		this.addCentredText(game.height / 2 + 44, "You won!");
		this.winEmitter1 = new WinSparkleEmitter(game.width / 4, game.height / 2);
		this.winEmitter2 = new WinSparkleEmitter(game.width * 3 / 4, game.height / 2);
	}

	//------------------------------------------------------------------------------

	public switchTitle()
	{
		this.changeCentredText(this.titleText, "Anticlockwise!");
	}

	//------------------------------------------------------------------------------

	private resetLayer(map: TileMapEntity)
	{
		// If this is the current map, recreate it
		if (map === this.currentMap)
			this.currentMap.reset();

		map.fadeIn(null);

		if (map === this.currentMap && this.isRestarting)
		{
			this.player.reset();
			this.player.fadeIn();
			this.isRestarting = false;
		}
	}

	//------------------------------------------------------------------------------

	public setCurrentMap(map: TileMapEntity)
	{
		this.currentMap = map;
		this.player.setMapEntryPos();
	}

	//------------------------------------------------------------------------------

	private addCentredText(y: number, str: string, color?: string): Phaser.Text
	{
		var text = this.add.text(0, y, str, { font: "24px Verdana,Helvetica,sans-serif" });
		var left = (game.width - text.width) * 0.5;
		text.position.x = left;
		if (!color)
			color = '#ffff00';
		text.addColor(color, 0);
		return text;
	}

	//------------------------------------------------------------------------------

	private changeCentredText(text: Phaser.Text, newStr: string)
	{
		text.text = newStr;
		text.position.x = (game.width - text.width) * 0.5;
	}

	//------------------------------------------------------------------------------

	private maps: { [key: string]: TileMapEntity; };
	private currentMap: TileMapEntity;
	public player: PlayerEntity;
	private fpsText: Phaser.Text;
	private titleText: Phaser.Text;
	private winEmitter1: WinSparkleEmitter;
	private winEmitter2: WinSparkleEmitter;
	private isRestarting: boolean;

	public brokeWallSound: Phaser.Sound;
	public chargeSound: Phaser.Sound;
	public getDiamondSound: Phaser.Sound;
	public getKeySound: Phaser.Sound;
	public gravitySound: Phaser.Sound;
	public openDoorSound: Phaser.Sound;
	public rockInHoleSound: Phaser.Sound;
}

//------------------------------------------------------------------------------

var game = new ClockwiseGame();
