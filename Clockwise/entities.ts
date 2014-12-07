/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Entity classes
/// 
/// <reference path='phaser/phaser.d.ts'/>
/// <reference path='emitters.ts'/>

//------------------------------------------------------------------------------

class Entity
{
	constructor() { }

	public update() { }
}

//------------------------------------------------------------------------------

class SpriteEntity extends Entity
{
	constructor(x: number, y: number, key: string, sprite?: Phaser.Sprite)
	{
		super();

		if (sprite)
			this.sprite = sprite;
		else
			this.sprite = game.add.sprite(x, y, key);
	}

	public sprite: Phaser.Sprite;
}

//------------------------------------------------------------------------------

class PlayerEntity extends SpriteEntity
{
	static NORMAL_VEL = 200;
	static CHARGE_VEL = 400;
	static WALL_BREAK_VEL = 300;
	static DIAG_FACTOR = 0.7071;
	static ACCELERATION = 1500;
	static DRAG = 1000;

	constructor(x: number, y: number)
	{
		super(x, y, 'guy');
		game.physics.arcade.enable(this.sprite);

		this.cursorKeys = game.input.keyboard.createCursorKeys();
		this.isCharging = false;
		this.isStunned = false;
		this.chargeHaltPending = false;
		this.prevVel = new Phaser.Point(0, 0);

		var body: Phaser.Physics.Arcade.Body = this.sprite.body;
		body.maxVelocity.setTo(PlayerEntity.NORMAL_VEL, PlayerEntity.NORMAL_VEL);
		body.drag.setTo(PlayerEntity.DRAG, PlayerEntity.DRAG);
		body.bounce.x = 0.2;
		body.bounce.y = 0.2;
	}

	//------------------------------------------------------------------------------

	public update()
	{
		var vel = this.sprite.body.velocity;
		this.prevVel.setTo(vel.x, vel.y);

		if (this.chargeHaltPending)
		{
			// Stop the player's charge with a thump
			this.chargeHaltPending = false;
			this.isCharging = false;
			this.isStunned = true;
			game.time.events.add(500, () => this.isStunned = false, null).timer.start();
		}

		var accel = this.sprite.body.acceleration;
		accel.x = 0;
		accel.y = 0;
		if (!this.isStunned)
		{
			this.isCharging = !!game.input.keyboard.isDown(Phaser.Keyboard.SHIFT);		// make sure not down gives false

			if (this.cursorKeys.right.isDown)
				accel.x = PlayerEntity.ACCELERATION;
			else if (this.cursorKeys.left.isDown)
				accel.x = -PlayerEntity.ACCELERATION;

			if (this.cursorKeys.up.isDown)
				accel.y = -PlayerEntity.ACCELERATION;
			else if (this.cursorKeys.down.isDown)
				accel.y = PlayerEntity.ACCELERATION;

			// Diagonal scaling
			var diagonal = accel.x !== 0 && accel.y !== 0;
			if (diagonal)
			{
				accel.x *= PlayerEntity.DIAG_FACTOR;
				accel.y *= PlayerEntity.DIAG_FACTOR;
			}

			// Set the maximum velocity
			var maxVel: number = this.isCharging ? PlayerEntity.CHARGE_VEL : PlayerEntity.NORMAL_VEL;
			if (diagonal)
				maxVel *= PlayerEntity.DIAG_FACTOR;
			this.sprite.body.maxVelocity.setTo(maxVel, maxVel);
		}
	}

	//------------------------------------------------------------------------------

	public haltCharge()
	{
		if (this.isCharging)
			this.chargeHaltPending = true;
	}

	//------------------------------------------------------------------------------

	public canBreak(sprite: Phaser.Sprite)
	{
		// Can only break if charging
		if (!this.isCharging)
			return;

		// Can only break if (player vel) dot (normalized offset of sprite from player) is at least a given value
		var playerVel: Phaser.Point = this.prevVel;
		var spriteOffset: Phaser.Point = Phaser.Point.subtract(sprite.position, this.sprite.position).normalize();
		var velInDir: number = playerVel.dot(spriteOffset);
		return velInDir >= PlayerEntity.WALL_BREAK_VEL;
	}

	//------------------------------------------------------------------------------

	private cursorKeys: Phaser.CursorKeys;
	private prevVel: Phaser.Point;
	public isCharging: boolean;
	private chargeHaltPending: boolean;
	private isStunned: boolean;
}

//------------------------------------------------------------------------------

var TILE_WALL = 1;
var TILE_WATER = 2;
var TILE_UP = 3;
var TILE_DOWN = 4;
var TILE_BREAKABLE_WALL = 5;
var TILE_MONSTER = 6;
var TILE_HOLE = 6;
var TILE_ROCK = 7;
var TILE_DOOR = 8;
var TILE_DIAMOND = 9;
var TILE_KEY = 10;
var TILE_BUTTON = 11;

class TileMapEntity extends Entity
{
	constructor(tilemap: string, tileset: string)
	{
		super();

		this.name = tilemap;

		this.tileMap = game.add.tilemap(tilemap);
		this.tileMap.addTilesetImage(tileset);
		this.layers = [];
		for (var layerName in { "Tile Layer 1": 0, "Tile Layer 2": 0 })
		{
			var layer: TileMapLayerEntity = new TileMapLayerEntity(this.tileMap.createLayer(layerName), this);
			layer.stop();
			this.layers.push(layer);
		}

		this.currentLayer = null;

		this.haveGoneUp = false;

		this.switchTo(0);
	}

	//------------------------------------------------------------------------------

	public update()
	{
	}

	//------------------------------------------------------------------------------

	private adjustLayer(adjust: number)
	{
		if (adjust > 0)
		{
			this.haveGoneUp = false;
			this.switchTo(1);
		}
		else
		{
			this.haveGoneUp = true;
			this.switchTo(0);
		}
	}

	//------------------------------------------------------------------------------

	private triggerLevelChange(adjust: number)
	{
		if (adjust > 0)
		{
			if (!this.haveGoneUp)
			{
				this.haveGoneUp = true;
				this.linkedMap.adjustLayer(adjust);
			}
		}
		else
		{
			if (this.haveGoneUp)
			{
				this.haveGoneUp = false;
				this.linkedMap.adjustLayer(adjust);
			}
		}
	}

	//------------------------------------------------------------------------------

	private switchTo(layerIndex: number)
	{
		console.log(this.name, "switching to", layerIndex);
		if (this.currentLayer)
			this.currentLayer.stop();

		this.currentLayer = this.layers[layerIndex];
		this.currentLayer.start();

		this.currentLayerIndex = layerIndex;

		this.tileMap.setCollision(1);

		this.tileMap.setTileIndexCallback(TILE_UP, () => this.triggerLevelChange(+1), null);
		this.tileMap.setTileIndexCallback(TILE_DOWN, () => this.triggerLevelChange(-1), null);
	}

	//------------------------------------------------------------------------------

	public name: string;
	public currentLayer: TileMapLayerEntity;
	public linkedMap: TileMapEntity;

	private tileMap: Phaser.Tilemap;
	private layers: TileMapLayerEntity[];
	private currentLayerIndex: number;
	private triggerCallback: () => void;
	private haveGoneUp: boolean;
}

//------------------------------------------------------------------------------

var ROCK_DRAG = 100;

class TileMapLayerEntity extends Entity
{
	constructor(layer: Phaser.TilemapLayer, tileMapEntity: TileMapEntity)
	{
		super();

		this.tileMap = tileMapEntity;
		this.layer = layer;
		this.entities = [];

		this.breakableWallGroup = game.add.group();
		this.breakableWallGroup.enableBody = true;
		this.breakableWallGroup.visible = false;

		this.holeGroup = game.add.group();
		this.holeGroup.enableBody = true;
		this.holeGroup.visible = false;
		//this.holes = [];

		this.rockGroup = game.add.group();
		this.rockGroup.enableBody = true;
		this.rockGroup.visible = false;
		//this.rocks = [];

		layer.map.createFromTiles(TILE_BREAKABLE_WALL, -1, 'breakable', layer, this.breakableWallGroup);
		this.breakableWallGroup.forEach(sprite => sprite.body.immovable = true, null);

		layer.map.createFromTiles(TILE_MONSTER, -1, 'hole', layer, this.holeGroup);
		this.holeGroup.forEach(sprite =>
		{
			sprite.body.immovable = true;
		}, null);

		layer.map.createFromTiles(TILE_ROCK, -1, 'rock', layer, this.rockGroup);
		this.rockGroup.forEach(sprite =>
		{
			sprite.body.drag.setTo(ROCK_DRAG, ROCK_DRAG);
		}, null);
	}

	//------------------------------------------------------------------------------

	public start()
	{
		this.layer.visible = true;
		this.layer.debug = true;
		this.layer.map.setLayer(this.layer);

		this.breakableWallGroup.visible = true;
		this.holeGroup.visible = true;
		this.rockGroup.visible = true;
	}

	//------------------------------------------------------------------------------

	public stop()
	{
		this.layer.visible = false;
		this.breakableWallGroup.visible = false;
		this.holeGroup.visible = false;
		this.rockGroup.visible = false;
	}

	//------------------------------------------------------------------------------

	public collideWithPlayer(player: PlayerEntity)
	{
		var arcadePhysics = game.physics.arcade;
		arcadePhysics.collide(player.sprite, this.layer, this.hitUnbreakableWall, null, this);
		arcadePhysics.collide(player.sprite, this.breakableWallGroup, this.hitBreakableWall, null, this);
		arcadePhysics.collide(player.sprite, this.holeGroup);
		arcadePhysics.collide(player.sprite, this.rockGroup);
	}

	//------------------------------------------------------------------------------
	// Collide mobile objects with a group of walls (e.g., external ones - but we call this for internal ones as well)

	public collideMobileObjectsWithLayer(layerEntity: TileMapLayerEntity)
	{
		//console.log(this.tileMap.name, "colliding with", layer.tileMap.name);
		var arcadePhysics = game.physics.arcade;

		// Collide the monsters and rocks with the walls in the given layer
		/*var collideTargets = [layer, layer.breakableWallGroup];
		for (var targetIndex = 0; targetIndex < collideTargets.length; ++targetIndex)
		{
			var wallGroup = collideTargets[targetIndex];
			arcadePhysics.collide(this.monsterGroup, wallGroup);
			arcadePhysics.collide(this.rockGroup, wallGroup);
		}*/
		arcadePhysics.collide(this.rockGroup, layerEntity.layer);
		arcadePhysics.collide(this.rockGroup, layerEntity.breakableWallGroup);
	}

	//------------------------------------------------------------------------------

	public collideMobileObjectsTogether()
	{
		// Collide the rocks with the holes in the same layer, and the rocks with the other rocks
		game.physics.arcade.overlap(this.rockGroup, this.holeGroup, this.rockHitHole);
		game.physics.arcade.collide(this.rockGroup, this.rockGroup);
	}

	//------------------------------------------------------------------------------

	private hitUnbreakableWall(playerSprite: Phaser.Sprite, wall: Phaser.Sprite)
	{
		game.player.haltCharge();
	}

	//------------------------------------------------------------------------------

	private hitBreakableWall(playerSprite: Phaser.Sprite, wall: Phaser.Sprite)
	{
		var breakWall = game.player.canBreak(wall);
		game.player.haltCharge();
		if (!breakWall)
			return;

		new BreakableWallEmitter(wall.x, wall.y);
		wall.kill();
	}

	//------------------------------------------------------------------------------

	private rockHitHole(rockSprite: Phaser.Sprite, holeSprite: Phaser.Sprite)
	{
		var arcadePhysics = game.physics.arcade;
		var body: Phaser.Physics.Arcade.Body = rockSprite.body;
		if (arcadePhysics.distanceBetween(rockSprite, holeSprite) < 5)
		{
			// Fill the hole with the rock - destroy both objects
			new FilledHoleEmitter(holeSprite.x, holeSprite.y);
			rockSprite.kill();
			holeSprite.kill();
			return;
		}

		// Move the rock towards the centre of the hole
		game.physics.arcade.accelerateToObject(rockSprite, holeSprite, 100, 500, 500);
	}

	//------------------------------------------------------------------------------

	private tileMap: TileMapEntity;
	private layer: Phaser.TilemapLayer;

	private breakableWallGroup: Phaser.Group;
	private holeGroup: Phaser.Group;
	private rockGroup: Phaser.Group;

	//private holes: HoleEntity[];
	//private rocks: RockEntity[];

	private entities: Entity[];
}

//------------------------------------------------------------------------------

/*class HoleEntity extends SpriteEntity
{
	constructor(sprite: Phaser.Sprite)
	{
		super(0, 0, null, sprite);
		sprite.body.immovable = true;
	}
}

//------------------------------------------------------------------------------

class RockEntity extends SpriteEntity
{
	static DRAG = 100;

	constructor(sprite: Phaser.Sprite)
	{
		super(0, 0, null, sprite);
		sprite.body.drag.setTo(RockEntity.DRAG, RockEntity.DRAG);
	}
}
*/
//------------------------------------------------------------------------------
