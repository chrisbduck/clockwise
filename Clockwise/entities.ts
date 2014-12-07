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
	static CAMERA_SHAKE_VEL_SQ = 300 * 300;
	static DIAG_FACTOR = 0.7071;
	static ACCELERATION = 1500;
	static DRAG = 1000;
	static WALK_ANIM_SPEED = 10;
	static CHARGE_ANIM_SPEED = 5;

	constructor(x: number, y: number)
	{
		super(x, y, 'guy');
		game.physics.arcade.enable(this.sprite);

		this.cursorKeys = game.input.keyboard.createCursorKeys();
		this.isCharging = false;
		this.isStunned = false;
		this.chargeHaltPending = false;
		this.prevVel = new Phaser.Point(0, 0);

		var anims = this.sprite.animations;
		var animSpeed = PlayerEntity.WALK_ANIM_SPEED;
		anims.add('down', [0, 1, 2, 3], animSpeed, true);
		anims.add('up', [4, 5, 6, 7], animSpeed, true);
		anims.add('right', [8, 9, 10, 11], animSpeed, true);
		anims.add('left', [12, 13, 14, 15], animSpeed, true);

		var body: Phaser.Physics.Arcade.Body = this.sprite.body;
		body.maxVelocity.setTo(PlayerEntity.NORMAL_VEL, PlayerEntity.NORMAL_VEL);
		body.drag.setTo(PlayerEntity.DRAG, PlayerEntity.DRAG);
		body.bounce.x = 0.2;
		body.bounce.y = 0.2;

		this.hasKey = false;
		this.keyDisplay = null;
		this.hasDiamond = false;
		this.diamondDisplay = null;
		this.sparkleEmitter = null;
	}

	//------------------------------------------------------------------------------

	public update()
	{
		var vel = this.sprite.body.velocity;
		this.prevVel.setTo(vel.x, vel.y);

		if (this.sparkleEmitter != null)
			this.sparkleEmitter.setPosition(this.sprite.position);

		/*if (this.chargeHaltPending)
		{
			// Stop the player's charge with a thump
			this.chargeHaltPending = false;
			this.isCharging = false;
			this.isStunned = true;
			game.time.events.add(500, () => this.isStunned = false, null).timer.start();
			
			// Shake the camera
			game.camera.y = 0;
			game.add.tween(game.camera).to({ x: -10 }, 30, Phaser.Easing.Sinusoidal.InOut, true, 0, 4, true);
		}*/

		var accel = this.sprite.body.acceleration;
		accel.x = 0;
		accel.y = 0;
		if (!this.isStunned)
		{
			this.isCharging = !!game.input.keyboard.isDown(Phaser.Keyboard.SHIFT);		// make sure "not down" gives false

			var animKey = null;

			// Check left/right
			if (this.cursorKeys.right.isDown)
			{
				accel.x = PlayerEntity.ACCELERATION;
				animKey = 'right';
			}
			else if (this.cursorKeys.left.isDown)
			{
				accel.x = -PlayerEntity.ACCELERATION;
				animKey = 'left';
			}

			// Check up/down second because its animation takes precedence
			if (this.cursorKeys.up.isDown)
			{
				accel.y = -PlayerEntity.ACCELERATION;
				animKey = 'up';
			}
			else if (this.cursorKeys.down.isDown)
			{
				accel.y = PlayerEntity.ACCELERATION;
				animKey = 'down';
			}

			// Play animation
			var anims = this.sprite.animations;
			if (animKey === null)
				anims.stop();
			else
				anims.play(animKey, this.isCharging ? PlayerEntity.CHARGE_ANIM_SPEED : PlayerEntity.WALK_ANIM_SPEED);

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
		if (!this.isCharging)
			return;

		// Stop the player's charge with a thump
		this.isCharging = false;
		this.isStunned = true;
		game.time.events.add(500, () => this.isStunned = false, null).timer.start();

		// Shake the camera, if the speed was high enough
		if (this.prevVel.getMagnitudeSq() >= PlayerEntity.CAMERA_SHAKE_VEL_SQ)
		{
			game.camera.setPosition(0, 0);
			var targetPos: Phaser.Point = new Phaser.Point(this.prevVel.x, this.prevVel.y).setMagnitude(10);
			game.add.tween(game.camera).to({ x: targetPos.x, y: targetPos.y }, 30, Phaser.Easing.Sinusoidal.InOut, true, 0, 4, true);
		}
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

	public collectKey(key: Phaser.Sprite)
	{
		this.keyDisplay = key;
		key.position.setTo(0, 32);
		key.body.velocity.setTo(0, 0);
		this.hasKey = true;
	}

	//------------------------------------------------------------------------------

	public useKey()
	{
		this.keyDisplay.kill();
		this.keyDisplay = null;
		this.hasKey = false;
	}

	//------------------------------------------------------------------------------

	public openDoor(door: Phaser.Sprite)
	{
		if (!this.hasKey)
			return;

		door.animations.play('open');
		(<IDoor><any>door).isOpen = true;
		this.useKey();
	}

	//------------------------------------------------------------------------------

	public collectDiamond(diamond: Phaser.Sprite)
	{
		this.diamondDisplay = diamond;
		diamond.position.setTo(0, 64);
		diamond.body.velocity.setTo(0, 0);
		this.hasDiamond = true;

		if (this.sparkleEmitter == null)
			this.sparkleEmitter = new DiamondSparkleEmitter(this.sprite.position.x, this.sprite.position.y);
	}

	//------------------------------------------------------------------------------

	public isCharging: boolean;
	public hasKey: boolean;
	public hasDiamond: boolean;
	private cursorKeys: Phaser.CursorKeys;
	private prevVel: Phaser.Point;
	private chargeHaltPending: boolean;
	private isStunned: boolean;
	private keyDisplay: Phaser.Sprite;
	private diamondDisplay: Phaser.Sprite;
	private sparkleEmitter: DiamondSparkleEmitter;
}

//------------------------------------------------------------------------------

enum ButtonSide
{
	LEFT = 10,
	RIGHT = 11,
	TOP = 12,
	BOTTOM = 13,
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

		// Breakable walls
		this.breakableWallGroup = this.createGroup(TILE_BREAKABLE_WALL, 'breakable');
		this.breakableWallGroup.forEach(sprite => sprite.body.immovable = true, null);

		// Holes
		this.holeGroup = this.createGroup(TILE_MONSTER, 'hole');
		this.holeGroup.forEach(sprite =>
		{
			sprite.body.immovable = true;
		}, null);

		// Rocks
		this.rockGroup = this.createGroup(TILE_ROCK, 'rock');
		this.rockGroup.forEach(sprite =>
		{
			sprite.body.drag.setTo(ROCK_DRAG, ROCK_DRAG);
		}, null);

		// Keys
		this.keyGroup = this.createGroup(TILE_KEY, 'key');

		// Diamonds
		this.diamondGroup = this.createGroup(TILE_DIAMOND, 'diamond');

		// Doors
		this.doorGroup = this.createGroup(TILE_DOOR, 'door');
		this.doorGroup.forEach(doorSprite =>
		{
			doorSprite.body.immovable = true;
			(<IDoor><any>doorSprite).isOpen = false;
			var anims: Phaser.AnimationManager = doorSprite.animations;
			anims.add('open', [0, 1, 2, 3, 4], 10, false);
			anims.add('close', [4, 3, 2, 1, 0], 10, false);
		}, null);

		// Buttons
		this.buttonGroup = this.createGroup(TILE_BUTTON, 'button');
		this.buttonGroup.forEach(buttonSprite =>
		{
			buttonSprite.body.immovable = true;
			(<IButton><any>buttonSprite).isPressed = false;
		}, null);

		// All groups
		this.allGroups = [this.breakableWallGroup, this.holeGroup, this.rockGroup, this.keyGroup, this.diamondGroup, this.doorGroup, this.buttonGroup];

		this.allGroups.forEach(group => group.visible = false);
	}

	//------------------------------------------------------------------------------

	private createGroup(tileNum: number, spriteKey: string): Phaser.Group
	{
		var group: Phaser.Group = game.add.group();
		group.enableBody = true;
		this.layer.map.createFromTiles(tileNum, -1, spriteKey, this.layer, group);
		return group;
	}

	//------------------------------------------------------------------------------

	public start()
	{
		this.layer.visible = true;
		//this.layer.debug = true;
		this.layer.map.setLayer(this.layer);

		this.allGroups.forEach(group => group.visible = true);
	}

	//------------------------------------------------------------------------------

	public stop()
	{
		this.layer.visible = false;
		this.allGroups.forEach(group => group.visible = false);
	}

	//------------------------------------------------------------------------------

	public collideWithPlayer(player: PlayerEntity)
	{
		var arcadePhysics = game.physics.arcade;
		arcadePhysics.collide(player.sprite, this.layer, this.hitUnbreakableWall, null, this);
		arcadePhysics.collide(player.sprite, this.breakableWallGroup, this.hitBreakableWall, null, this);
		arcadePhysics.collide(player.sprite, this.holeGroup);
		arcadePhysics.collide(player.sprite, this.rockGroup);
		arcadePhysics.collide(player.sprite, this.keyGroup, (playerSprite, key) => player.collectKey(key));
		arcadePhysics.collide(player.sprite, this.diamondGroup, (playerSprite, diamond) => player.collectDiamond(diamond));
		arcadePhysics.collide(player.sprite, this.doorGroup, (playerSprite, door) => player.openDoor(door), (playerSprite, door) => !(<IDoor><any>door).isOpen);
		arcadePhysics.overlap(player.sprite, this.buttonGroup, (playerSprite, button) => this.pressButton(button));
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

		arcadePhysics.collide(this.keyGroup, layerEntity.layer);
		arcadePhysics.collide(this.keyGroup, layerEntity.breakableWallGroup);

		arcadePhysics.collide(this.diamondGroup, layerEntity.layer);
		arcadePhysics.collide(this.diamondGroup, layerEntity.breakableWallGroup);
	}

	//------------------------------------------------------------------------------

	public collideMobileObjectsTogether()
	{
		// Collide the rocks with the holes in the same layer, and the rocks with the other rocks
		game.physics.arcade.overlap(this.rockGroup, this.holeGroup, this.rockHitHole);
		game.physics.arcade.collide(this.rockGroup, this.rockGroup);

		// Rocks and such can roll over keys.
		// Not bothering to check for collisions with diamonds; there'll probably only be one.
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

	public pressButton(button: Phaser.Sprite)
	{
		// Check if already pressed
		var iButton: IButton = (<IButton><any>button);
		if (iButton.isPressed)
			return;

		// Change gravity
		var BUTTON_GRAVITY = 300;
		var side = this.getButtonSide(button);
		var gravityX: number = (side == ButtonSide.LEFT) ? -BUTTON_GRAVITY : (side == ButtonSide.RIGHT ? BUTTON_GRAVITY : 0);
		var gravityY: number = (side == ButtonSide.TOP) ? -BUTTON_GRAVITY : (side == ButtonSide.BOTTOM ? BUTTON_GRAVITY : 0);

		var gravityGroups = [this.rockGroup, this.keyGroup, this.diamondGroup];
		gravityGroups.forEach(group =>
		{
			group.forEach(sprite =>
			{
				sprite.body.gravity.setTo(gravityX, gravityY);
				sprite.body.enableGravity = true;
			}, null);
		});

		// Unpress all buttons
		this.buttonGroup.forEach(otherButton =>
		{
			otherButton.frame = 0;
			(<IButton><any>otherButton).isPressed = false;
		}, null);

		// Set this one as pressed
		button.frame = 1;
		iButton.isPressed = true;
	}

	//------------------------------------------------------------------------------

	private getButtonSide(button: Phaser.Sprite): ButtonSide
	{
		var buttonTilePos: Phaser.Point = new Phaser.Point();
		this.layer.getTileXY(button.position.x, button.position.y, buttonTilePos);
		console.log('button tile pos', buttonTilePos);

		// Get a quadrant
		buttonTilePos.x = buttonTilePos.x % (NUM_TILES / 2);
		buttonTilePos.y = buttonTilePos.y % (NUM_TILES / 2);

		var offsetX: number = Math.abs(NUM_TILES / 4 - buttonTilePos.x);
		var offsetY: number = Math.abs(NUM_TILES / 4 - buttonTilePos.y);
		if (offsetX > offsetY)
		{
			var leftSide: boolean = buttonTilePos.x < NUM_TILES / 4;
			console.log('left', leftSide);
			return leftSide ? ButtonSide.LEFT : ButtonSide.RIGHT;
		}

		var topSide: boolean = buttonTilePos.y < NUM_TILES / 4;
		console.log('top', topSide);
		return topSide ? ButtonSide.TOP : ButtonSide.BOTTOM;
	}

	//------------------------------------------------------------------------------

	private tileMap: TileMapEntity;
	private layer: Phaser.TilemapLayer;

	private breakableWallGroup: Phaser.Group;
	private holeGroup: Phaser.Group;
	private rockGroup: Phaser.Group;
	private keyGroup: Phaser.Group;
	private diamondGroup: Phaser.Group;
	private doorGroup: Phaser.Group;
	private buttonGroup: Phaser.Group;
	private allGroups: Phaser.Group[];

	//private holes: HoleEntity[];
	//private rocks: RockEntity[];

	private entities: Entity[];
}

//------------------------------------------------------------------------------

interface IDoor
{
	isOpen: boolean;
}

interface IButton
{
	isPressed: boolean;
}

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
