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
	constructor(x: number, y: number, key: string)
	{
		super();
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
		super(x, y, 'ship');
		game.physics.arcade.enable(this.sprite);

		this.cursorKeys = game.input.keyboard.createCursorKeys();
		this.isCharging = false;
		this.isStunned = false;
		this.chargeHaltPending = false;
		this.prevVel = new Phaser.Point(0, 0);

		this.sprite.body.maxVelocity.setTo(PlayerEntity.NORMAL_VEL, PlayerEntity.NORMAL_VEL);
		this.sprite.body.drag.setTo(PlayerEntity.DRAG, PlayerEntity.DRAG);
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

var TILE_UP = 3;
var TILE_DOWN = 4;
var TILE_BREAKABLE_WALL = 5;

class TileMapEntity extends Entity
{
	constructor(tilemap: string, tileset: string)
	{
		super();

		this.name = tilemap;

		this.tileMap = game.add.tilemap(tilemap);
		this.tileMap.addTilesetImage(tileset);
		this.layers = [];
		this.layers.push(new TileMapLayerEntity(this.tileMap.createLayer("Tile Layer 1")));
		this.layers.push(new TileMapLayerEntity(this.tileMap.createLayer("Tile Layer 2")));
		this.layers.forEach(layer => layer.stop());

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

	private tileMap: Phaser.Tilemap;
	private name: string;
	private layers: TileMapLayerEntity[];
	public currentLayer: TileMapLayerEntity;
	private currentLayerIndex: number;
	private triggerCallback: () => void;
	private haveGoneUp: boolean;
	public linkedMap: TileMapEntity;

	private walled: boolean;
}

//------------------------------------------------------------------------------

class TileMapLayerEntity extends Entity
{
	constructor(layer: Phaser.TilemapLayer)
	{
		super();

		this.layer = layer;
		this.entities = [];

		this.group = game.add.group();
		this.group.enableBody = true;
		this.group.visible = false;

		layer.map.createFromTiles(TILE_BREAKABLE_WALL, -1, 'breakable', layer, this.group, { 'body.immovable': true });
		this.group.forEach(sprite => sprite.body.immovable = true, null);
	}

	//------------------------------------------------------------------------------

	public start()
	{
		this.layer.visible = true;
		this.layer.debug = true;
		this.layer.map.setLayer(this.layer);

		this.group.visible = true;
	}

	//------------------------------------------------------------------------------

	public stop()
	{
		this.layer.visible = false;
		this.group.visible = false;
	}

	//------------------------------------------------------------------------------

	public collideWithPlayer(player: PlayerEntity)
	{
		var arcadePhysics = game.physics.arcade;
		arcadePhysics.collide(player.sprite, this.layer, this.hitUnbreakableWall, null, this);

		arcadePhysics.collide(player.sprite, this.group, this.hitBreakableWall, null, this);
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

	private layer: Phaser.TilemapLayer;
	private group: Phaser.Group;
	private entities: Entity[];
}

//------------------------------------------------------------------------------
