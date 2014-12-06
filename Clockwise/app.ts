﻿/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Main app
/// 
/// <reference path='phaser/phaser.d.ts'/>
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
		this.load.image('ship', 'data/tex/player-ship.png');
		this.load.image('tiles', 'data/tex/tiles.png');
		this.load.tilemap('map-top-left', 'data/map/top-left.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-top-right', 'data/map/top-right.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-bottom-left', 'data/map/bottom-left.json', null, Phaser.Tilemap.TILED_JSON);
		this.load.tilemap('map-bottom-right', 'data/map/bottom-right.json', null, Phaser.Tilemap.TILED_JSON);
		console.log("Preloaded", this);
	}

	//------------------------------------------------------------------------------

	private _create()
	{
		this.physics.startSystem(Phaser.Physics.ARCADE);

		this.maps = [];
		this.maps.push(new TileMapEntity('map-top-left', 'tiles', () => this.maps[3].nextLayer()));
		this.maps.push(new TileMapEntity('map-top-right', 'tiles', () => this.maps[0].nextLayer()));
		this.maps.push(new TileMapEntity('map-bottom-right', 'tiles', () => this.maps[1].nextLayer()));
		this.maps.push(new TileMapEntity('map-bottom-left', 'tiles', () => this.maps[2].nextLayer()));

		this.player = new PlayerEntity(32, 32);

		this.fpsText = this.add.text(4, 4, "FPS: 0", { font: "24px Verdana,Helvetica,sans-serif" });
		this.time.advancedTiming = true;

		this.time.events.loop(1000, () => this.fpsText.text = "FPS: " + this.time.fps, null);
		//this.time.events.loop(1000, () => console.log(this.time.fps), null).timer.start();
	}

	//------------------------------------------------------------------------------

	private _update()
	{
		this.maps.forEach(map => game.physics.arcade.collide(this.player.sprite, map.currentLayer));

		this.player.update();
	}

	//------------------------------------------------------------------------------

	private maps: TileMapEntity[];
	private player: PlayerEntity;
	private fpsText: Phaser.Text;
}

var game = new ClockwiseGame();

/*
class TestGame extends Phaser.Game
{
	constructor()
	{
		super(800, 600, Phaser.AUTO, '', { preload: () => this.testPreload(), create: () => this.testCreate(), update: () => this.testUpdate() });
	}

	private testPreload()
	{
		console.log("Preloading", this);
		this.load.image('sky', 'assets/sky.png');
		this.load.image('ground', 'assets/platform.png');
		this.load.image('star', 'assets/star.png');
		this.load.spritesheet('guy', 'assets/dude.png', 32, 48);
		this.load.audio('errsound', 'assets/test.ogg', true);
	}

	private testCreate()
	{
		this.physics.startSystem(Phaser.Physics.ARCADE);

		// Platforms

		this.add.sprite(0, 0, 'sky');

		this.platforms = this.add.group();
		this.platforms.enableBody = true;

		var ground: Phaser.Sprite = this.platforms.create(0, this.world.height - 64, 'ground');
		ground.scale.setTo(2, 2);
		ground.body.immovable = true;

		var ledge: Phaser.Sprite = this.platforms.create(400, 400, 'ground');
		ledge.body.immovable = true;

		ledge = this.platforms.create(-150, 250, 'ground');
		ledge.body.immovable = true;

		// Player

		this.player = this.add.sprite(32, game.world.height - 150, 'guy');
		this.physics.arcade.enable(this.player);

		this.player.body.bounce.y = 0.2;
		this.player.body.gravity.y = 1400;
		this.player.body.collideWorldBounds = true;

		this.player.animations.add('left', [0, 1, 2, 3], 10, true);
		this.player.animations.add('right', [5, 6, 7, 8], 10, true);

		this.cursors = this.input.keyboard.createCursorKeys();

		this.scoreText = this.add.text(16, 16, 'Score: 0', { font: '32px A,Verdana', fill: '#000' });

		this.errsound = this.sound.add('errsound');

		// Stars

		this.stars = this.add.group();
		this.stars.enableBody = true;

		for (var starIndex = 0; starIndex < 12; ++starIndex)
		{
			var star: Phaser.Sprite = this.stars.create(starIndex * 70, 0, 'star');
			this.hackstar = star;
			star.body.gravity.y = 200;
			star.body.bounce.y = 0.7 + Math.random() * 0.2;
		}

		this.hackstar.body.gravity.y = 0;
		this.time.events.add(5000 + Math.random() * 2, () =>
		{
			this.hackstar.body.gravity.y = 100;
		}, null);
	}

	private testUpdate()
	{
		var arcadePhysics = this.physics.arcade;
		arcadePhysics.collide(this.player, this.platforms);
		arcadePhysics.collide(this.stars, this.platforms);
		arcadePhysics.overlap(this.player, this.stars, this.collectStar, null, this);

		this.player.body.velocity.x = 0;
		if (this.cursors.left.isDown)
		{
			this.player.body.velocity.x = -250;
			this.player.animations.play('left');
		}
		else if (this.cursors.right.isDown)
		{
			this.player.body.velocity.x = +250;
			this.player.animations.play('right');
		}
		else
		{
			this.player.animations.stop();
			this.player.frame = 4;
		}

		if (!this.player.body.touching.down)
			this.player.animations.stop();

		if (this.cursors.up.isDown && this.player.body.touching.down)
			this.player.body.velocity.y = -700;
	}

	private collectStar(player: Phaser.Sprite, star: Phaser.Sprite)
	{
		star.kill();
		this.score += 3;
		this.scoreText.text = 'Score: ' + this.score;
		this.errsound.play(undefined, undefined, undefined, undefined, true);
	}

	//------------------------------------------------------------------------------

	private platforms: Phaser.Group;
	private stars: Phaser.Group;
	private player: Phaser.Sprite;
	private cursors: Phaser.CursorKeys;
	private score: number = 0;
	private scoreText: Phaser.Text;
	private errsound: Phaser.Sound;
	private hackstar: Phaser.Sprite;
}
*/