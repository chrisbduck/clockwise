/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Entity classes
/// 
/// <reference path='phaser-ts/phaser.d.ts'/>
/// <reference path='emitters.ts'/>

var FADE_OUT_DURATION_MS = 2000;
var FADE_OUT_EASE = Phaser.Easing.Quadratic.Out;
var FADE_IN_DURATION_MS = 750;
var FADE_IN_EASE = Phaser.Easing.Quadratic.In;

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
		body.width = 18;
		body.offset.x = 7;
		// To decrease vertical collision annoyance
		(<any>body).height = 24;		// syntax is fine; spurious error from defs
		body.offset.y = 4;

		this.mapEntryPos = null;
		this.keyDisplay = game.add.sprite(0, 0, 'key');
		this.diamondDisplay = game.add.sprite(0, 0, 'diamond');
		this.sparkleEmitter = null;
		this.reset();
	}

	//------------------------------------------------------------------------------

	public update()
	{
		var vel = this.sprite.body.velocity;
		this.prevVel.setTo(vel.x, vel.y);

		// Move the sparkle emitter along with the player
		if (this.sparkleEmitter != null)
			this.sparkleEmitter.setPosition(this.sprite.position);

		var accel = this.sprite.body.acceleration;
		accel.x = 0;
		accel.y = 0;
		if (!this.isStunned)
		{
			this.isCharging = !!game.input.keyboard.isDown(Phaser.Keyboard.SHIFT);		// make sure "not down" gives false

			var animKey = null;

			// Check up/down
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

			// Check left/right second because its animation takes precedence
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

		// Debugging: Ctrl+K gives you a key
		if (game.input.keyboard.isDown(Phaser.Keyboard.K) && game.input.keyboard.isDown(Phaser.Keyboard.CONTROL) && !this.hasKey)
			this.collectKey(null);
	}

	//------------------------------------------------------------------------------

	public haltCharge()
	{
		if (!this.isCharging)
			return;

		// Stop the player's charge with a thump
		this.isCharging = false;
		this.isStunned = true;
		game.chargeSound.play();
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

	public collectKey(key?: Phaser.Sprite)
	{
		if (key != null)
			this.collectSprite(key);
		this.keyDisplay.visible = true;
		this.keyDisplay.bringToTop();
		this.hasKey = true;
		game.getKeySound.play();
	}

	//------------------------------------------------------------------------------

	private collectSprite(sprite: Phaser.Sprite)
	{
		hideSprite(sprite);
		sprite.body.velocity.setTo(0, 0);
		sprite.body.gravity.setTo(0, 0);
	}

	//------------------------------------------------------------------------------

	public useKey()
	{
		this.keyDisplay.visible = false;
		this.hasKey = false;
	}

	//------------------------------------------------------------------------------

	public static setDoorOpen(door: Phaser.Sprite)
	{
		door.animations.play('open');
		(<IDoor><any>door).isOpen = true;
	}

	//------------------------------------------------------------------------------

	public static setDoorClosed(door: Phaser.Sprite)
	{
		if (!(<IDoor><any>door).isFinal)		// don't show the final door closing ever
			door.animations.play('close');
		(<IDoor><any>door).isOpen = false;
	}

	//------------------------------------------------------------------------------

	public openDoor(door: Phaser.Sprite, doorTileType: number): boolean
	{
		// Can only open up doors with a key, or down doors with the diamond
		if ((doorTileType === TILE_DOOR_UP && !this.hasKey) || (doorTileType === TILE_DOOR_DOWN && !this.hasDiamond))
			return false;

		game.openDoorSound.play();
		PlayerEntity.setDoorOpen(door);
		if (doorTileType == TILE_DOOR_UP)
			this.useKey();
		return true;
	}

	//------------------------------------------------------------------------------

	public collectDiamond(diamond: Phaser.Sprite)
	{
		diamond.visible = false;
		this.collectSprite(diamond);
		this.diamondDisplay.visible = true;
		this.diamondDisplay.bringToTop();
		this.hasDiamond = true;
		game.getDiamondSound.play();
		game.switchTitle();

		if (this.sparkleEmitter == null)
			this.sparkleEmitter = new DiamondSparkleEmitter(this.sprite.position.x, this.sprite.position.y);
	}

	//------------------------------------------------------------------------------

	public static changeSpriteGroup(sprite: Phaser.Sprite, newGroup: Phaser.Group)
	{
		sprite.parent.removeChild(sprite);
		sprite.parent = newGroup;
		newGroup.addChild(sprite);
	}

	//------------------------------------------------------------------------------

	public fadeOut()
	{
		game.add.tween(this.sprite).to({ alpha: 0 }, FADE_OUT_DURATION_MS, FADE_OUT_EASE, true);
	}

	//------------------------------------------------------------------------------

	public fadeIn()
	{
		game.add.tween(this.sprite).to({ alpha: 1 }, FADE_IN_DURATION_MS, FADE_IN_EASE, true);
	}

	//------------------------------------------------------------------------------

	public reset()
	{
		if (this.mapEntryPos != null)
			this.sprite.position.setTo(this.mapEntryPos.x, this.mapEntryPos.y);

		this.hasKey = false;
		this.keyDisplay.visible = false;
		// Don't reset the diamond.  If the player has it, they can keep it.
	}

	//------------------------------------------------------------------------------

	public setMapEntryPos()
	{
		this.mapEntryPos = this.sprite.position.clone();
	}

	//------------------------------------------------------------------------------

	public isCharging: boolean;
	public hasKey: boolean;
	public hasDiamond: boolean;
	private cursorKeys: Phaser.CursorKeys;
	private prevVel: Phaser.Point;
	private mapEntryPos: Phaser.Point;
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
var TILE_DOOR_UP = 3;
var TILE_DOOR_DOWN = 4;
var TILE_BREAKABLE_WALL = 5;
var TILE_HOLE = 6;
var TILE_ROCK = 7;
var TILE_FINAL_DOOR = 8;
var TILE_DIAMOND = 9;
var TILE_KEY = 10;
var TILE_BUTTON = 11;

class TileMapEntity extends Entity
{
	constructor(tilemap: string, tileset: string, tileX: number, tileY: number, inShadow: boolean = true)
	{
		super();

		this.name = tilemap;

		this.tileMap = game.add.tilemap(tilemap);
		this.tileMap.addTilesetImage(tileset);
		this.layers = [];
		for (var layerName in { "Tile Layer 1": 0, "Tile Layer 2": 0, "Tile Layer 3": 0 })
			this.layers.push(this.createLayer(layerName));

		var shadowSize = TILE_SIZE * (NUM_TILES / 2 - 1);
		var shadowX = tileX;
		var shadowY = tileY;
		if (shadowX === 0)
			shadowX = 1;
		if (shadowY === 0)
			shadowY = 1;
		this.shadowBmp = game.add.bitmapData(shadowSize, shadowSize);
		this.shadowImg = game.add.image(shadowX * TILE_SIZE, shadowY * TILE_SIZE, this.shadowBmp);
		this.shadowImg.blendMode = PIXI.blendModes.MULTIPLY;
		this.shadowAlpha = inShadow ? 0 : 1;
		this.updateShadow();

		this.currentLayer = null;

		this.haveGoneUp = false;
		this.ignoreFirstSwitch = false;
		this.ignoreSwitchOnLastLayer = false;
		this.isCurrent = false;

		this.switchTo(0);
	}

	//------------------------------------------------------------------------------

	public update()
	{
		// Update the shadow brightness
		if (this.shadowAlpha !== this.shadowPrevAlpha)
			this.updateShadow();
	}

	//------------------------------------------------------------------------------

	private createLayer(layerName: string)
	{
		return new TileMapLayerEntity(this.tileMap.createLayer(layerName), layerName, this);
	}

	//------------------------------------------------------------------------------

	private updateShadow()
	{
		var alpha = Math.ceil(this.shadowAlpha * 255);
		this.shadowBmp.context.fillStyle = 'rgb(' + alpha + ', ' + alpha + ', ' + alpha + ')';
		this.shadowBmp.context.fillRect(0, 0, this.shadowBmp.width, this.shadowBmp.height);
		this.shadowBmp.dirty = true;

		this.shadowPrevAlpha = this.shadowAlpha;
		this.isVisible = this.shadowAlpha > 0;
		this.shadowImg.bringToTop();
	}

	//------------------------------------------------------------------------------

	private adjustLayer(adjust: number)
	{
		if (this.ignoreFirstSwitch)
		{
			this.ignoreFirstSwitch = false;
			return;
		}

		if (adjust > 0)
		{
			this.haveGoneUp = false;
			if (this.currentLayerIndex < this.layers.length - 1)
				this.switchTo(this.currentLayerIndex + 1);
		}
		else
		{
			this.haveGoneUp = true;
			if (this.currentLayerIndex > 0)
				this.switchTo(this.currentLayerIndex - 1);
		}
	}

	//------------------------------------------------------------------------------

	public triggerLevelChange(adjust: number)
	{
		if (adjust > 0)
		{
			console.log(this.name, "up");
			if (!this.haveGoneUp)
			{
				this.haveGoneUp = true;
				if (!(this.ignoreSwitchOnLastLayer && this.currentLayerIndex == this.layers.length - 1))
					this.linkedMap.adjustLayer(adjust);
				this.nextMap.fadeIn(TILE_DOOR_UP);
				this.prevMap.fadeOut(TILE_DOOR_UP);
				game.setCurrentMap(this.nextMap);
			}
		}
		else
		{
			console.log(this.name, "down");
			if (this.haveGoneUp)
			{
				this.haveGoneUp = false;
				if (!(this.ignoreSwitchOnLastLayer && this.currentLayerIndex == this.layers.length - 1))
					this.linkedMap.adjustLayer(adjust);
				this.nextMap.fadeOut(TILE_DOOR_DOWN);
				this.prevMap.fadeIn(TILE_DOOR_DOWN);
				game.setCurrentMap(this.prevMap);
			}
		}
	}

	//------------------------------------------------------------------------------

	public reset()
	{
		this.currentLayer.reset();
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

		this.tileMap.setCollision(TILE_WALL);

		//this.tileMap.setTileIndexCallback(TILE_DOOR_UP, () => this.triggerLevelChange(+1), null);
		//this.tileMap.setTileIndexCallback(TILE_DOOR_DOWN, () => this.triggerLevelChange(-1), null);
	}

	//------------------------------------------------------------------------------

	public setRelatedMaps(next: TileMapEntity, linked: TileMapEntity, prev: TileMapEntity)
	{
		this.nextMap = next;
		this.linkedMap = linked;
		this.prevMap = prev;
	}

	//------------------------------------------------------------------------------

	public fadeOut(closeDoorType: number, completeFn: (obj, tween) => void = null)
	{
		var tween = game.add.tween(this).to({ shadowAlpha: 0 }, FADE_OUT_DURATION_MS, FADE_OUT_EASE, true);
		if (completeFn != null)
			tween.onComplete.add(completeFn);

		if (closeDoorType === TILE_DOOR_UP || closeDoorType === TILE_DOOR_DOWN)
			this.currentLayer.adjustDoors(closeDoorType);
	}

	//------------------------------------------------------------------------------

	public fadeIn(closeDoorType: number, completeFn: (obj, tween) => void = null)
	{
		var tween = game.add.tween(this).to({ shadowAlpha: 1 }, FADE_IN_DURATION_MS, FADE_IN_EASE, true);
		if (completeFn != null)
			tween.onComplete.add(completeFn);

		if (closeDoorType === TILE_DOOR_UP || closeDoorType === TILE_DOOR_DOWN)
			this.currentLayer.adjustDoors(closeDoorType);
	}

	//------------------------------------------------------------------------------

	public name: string;
	public currentLayer: TileMapLayerEntity;

	private linkedMap: TileMapEntity;
	private prevMap: TileMapEntity;
	private nextMap: TileMapEntity;

	private tileMap: Phaser.Tilemap;
	private layers: TileMapLayerEntity[];
	private currentLayerIndex: number;
	private haveGoneUp: boolean;
	public ignoreFirstSwitch: boolean;
	public ignoreSwitchOnLastLayer: boolean;
	public isVisible: boolean;
	public isCurrent: boolean;

	private shadowBmp: Phaser.BitmapData;
	private shadowImg: Phaser.Image;
	private shadowAlpha: number;
	private shadowPrevAlpha: number;
}

//------------------------------------------------------------------------------

var ROCK_DRAG = 100;

class TileMapLayerEntity extends Entity
{
	constructor(layer: Phaser.TilemapLayer, name: string, tileMapEntity: TileMapEntity)
	{
		super();

		this.tileMap = tileMapEntity;
		this.layer = layer;
		this.name = name;

		// Water
		this.waterGroup = this.createGroup(TILE_WATER, 'water');
		this.waterGroup.forEach(water => water.body.immovable = true, null);

		// Breakable walls
		this.breakableWallGroup = this.createGroup(TILE_BREAKABLE_WALL, 'breakable');
		this.breakableWallGroup.forEach(sprite => sprite.body.immovable = true, null);

		// Holes
		this.holeGroup = this.createGroup(TILE_HOLE, 'hole');
		this.holeGroup.forEach(sprite => sprite.body.immovable = true, null);

		// Buttons
		this.buttonGroup = this.createGroup(TILE_BUTTON, 'button');
		this.buttonGroup.forEach(buttonSprite => this.initButton(buttonSprite), null);

		// Keys
		this.keyGroup = this.createGroup(TILE_KEY, 'key');

		// Diamonds
		this.diamondGroup = this.createGroup(TILE_DIAMOND, 'diamond');

		// Rocks
		this.rockGroup = this.createGroup(TILE_ROCK, 'rock');
		this.rockGroup.forEach(sprite =>
		{
			sprite.body.drag.setTo(ROCK_DRAG, ROCK_DRAG);
			// Make it easier to move these between things
			sprite.body.width = 28;
			sprite.body.height = 28;
			sprite.body.offset.x = 2;
			sprite.body.offset.y = 2;
		}, null);

		// Doors up
		this.doorUpGroup = this.createGroup(TILE_DOOR_UP, 'door');
		this.doorUpGroup.forEach(doorSprite =>
		{
			doorSprite.body.immovable = true;
			(<IDoor><any>doorSprite).isOpen = false;
			var anims: Phaser.AnimationManager = doorSprite.animations;
			anims.add('open', [0, 1, 2, 3, 4], 10, false);
			anims.add('close', [4, 3, 2, 1, 0], 10, false);
			doorSprite.frame = 0;
		}, null);

		// Doors down
		this.doorDownGroup = this.createGroup(TILE_DOOR_DOWN, 'door');
		var lengthWithoutFinalDoor = this.doorDownGroup.children.length;
		this.layer.map.createFromTiles(TILE_FINAL_DOOR, -1, 'door', this.layer, this.doorDownGroup);
		this.doorDownGroup.forEach(doorSprite =>
		{
			doorSprite.body.immovable = true;
			(<IDoor><any>doorSprite).isOpen = true;
			(<IDoor><any>doorSprite).isFinal = false;
			var anims: Phaser.AnimationManager = doorSprite.animations;
			anims.add('open', [5, 6, 7, 8, 9], 10, false);
			anims.add('close', [9, 8, 7, 6, 5], 10, false);
			doorSprite.frame = 9;
		}, null);
		if (this.doorDownGroup.children.length > lengthWithoutFinalDoor)
		{
			// There is a final door.  Tag it
			var door: Phaser.Sprite = (<Phaser.Sprite><any>this.doorDownGroup.children[this.doorDownGroup.children.length - 1]);
			door.frame = 5;
			(<IDoor><any>door).isOpen = false;
			(<IDoor><any>door).isFinal = true;
		}

		// All groups
		this.allGroups = [
			this.breakableWallGroup,
			this.holeGroup,
			this.rockGroup,
			this.keyGroup,
			this.diamondGroup,
			this.doorUpGroup,
			this.doorDownGroup,
			this.buttonGroup,
			this.waterGroup
		];

		// Make everything resettable
		this.allGroups.forEach(group => group.forEach(sprite => makeResettableSprite(sprite), null));

		this.stop();
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

		this.allGroups.forEach(group =>
		{
			group.visible = true;
			// Enable bodies on all visible sprites
			/*group.forEach(sprite =>
			{
				if (sprite.visible)
					sprite.body.enable = true;
			}, null);*/
		});
	}

	//------------------------------------------------------------------------------

	public stop()
	{
		this.layer.visible = false;
		this.allGroups.forEach(group =>
		{
			group.visible = false;
			// Disable bodies on all sprites; invisible ones already have disabled bodies
			//group.forEach(sprite => sprite.body.enable = false, null);
		});
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
		arcadePhysics.collide(player.sprite, this.doorUpGroup, (playerSprite, door) => this.openDoor(door, TILE_DOOR_UP), (playerSprite, door) => !(<IDoor><any>door).isOpen);
		arcadePhysics.collide(player.sprite, this.doorDownGroup, (playerSprite, door) => this.openDoor(door, TILE_DOOR_DOWN), (playerSprite, door) => !(<IDoor><any>door).isOpen);
		arcadePhysics.overlap(player.sprite, this.buttonGroup, (playerSprite, button) => this.pressButton(button));
		arcadePhysics.collide(player.sprite, this.waterGroup);
	}

	//------------------------------------------------------------------------------
	// Collide mobile objects with a group of walls (e.g., external ones - but we call this for internal ones as well)

	public collideMobileObjectsWithLayer(layerEntity: TileMapLayerEntity)
	{
		var arcadePhysics = game.physics.arcade;

		arcadePhysics.collide(this.rockGroup, layerEntity.layer);
		arcadePhysics.collide(this.rockGroup, layerEntity.breakableWallGroup);
		layerEntity.collideWithClosedDoors(this.rockGroup);

		arcadePhysics.collide(this.keyGroup, layerEntity.layer);
		arcadePhysics.collide(this.keyGroup, layerEntity.breakableWallGroup);
		arcadePhysics.collide(this.keyGroup, layerEntity.rockGroup);
		layerEntity.collideWithClosedDoors(this.keyGroup);

		arcadePhysics.collide(this.diamondGroup, layerEntity.layer);
		arcadePhysics.collide(this.diamondGroup, layerEntity.breakableWallGroup);
	}

	//------------------------------------------------------------------------------

	public collideMobileObjectsTogether()
	{
		var arcadePhysics = game.physics.arcade;

		// Collide the rocks with the holes in the same layer, and the rocks with the other rocks
		arcadePhysics.overlap(this.rockGroup, this.holeGroup, this.rockHitHole);
		arcadePhysics.collide(this.rockGroup, this.rockGroup);

		// Collide the keys with the rocks, and both with the doors
		arcadePhysics.collide(this.rockGroup, this.keyGroup);
		this.collideWithClosedDoors(this.rockGroup);
		this.collideWithClosedDoors(this.keyGroup);

		// Not bothering to check for collisions with diamonds; there'll probably only be one.
	}

	//------------------------------------------------------------------------------

	private collideWithClosedDoors(objToCheck: any)
	{
		var doorOpenCheck = (sprite, door) => !(<IDoor><any>door).isOpen;
		var arcadePhysics = game.physics.arcade;

		arcadePhysics.collide(objToCheck, this.doorUpGroup, null, doorOpenCheck);
		arcadePhysics.collide(objToCheck, this.doorDownGroup, null, doorOpenCheck);
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
		//wall.kill();
		hideSprite(wall);
		game.brokeWallSound.play();
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
			//rockSprite.kill();
			//holeSprite.kill();
			hideSprite(rockSprite);
			hideSprite(holeSprite);
			game.rockInHoleSound.play();
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
		this.buttonGroup.forEach(otherButton => this.setButtonPressed(otherButton, false), null);

		// Set this one as pressed
		this.setButtonPressed(button, true);

		game.gravitySound.play();
	}

	//------------------------------------------------------------------------------

	private getButtonSide(button: Phaser.Sprite): ButtonSide
	{
		var buttonTilePos: Phaser.Point = new Phaser.Point();
		this.layer.getTileXY(button.position.x, button.position.y, buttonTilePos);

		// Get a quadrant
		buttonTilePos.x = buttonTilePos.x % (NUM_TILES / 2);
		buttonTilePos.y = buttonTilePos.y % (NUM_TILES / 2);

		var offsetX: number = Math.abs(NUM_TILES / 4 - buttonTilePos.x);
		var offsetY: number = Math.abs(NUM_TILES / 4 - buttonTilePos.y);
		if (offsetX > offsetY)
		{
			var leftSide: boolean = buttonTilePos.x < NUM_TILES / 4;
			return leftSide ? ButtonSide.LEFT : ButtonSide.RIGHT;
		}

		var topSide: boolean = buttonTilePos.y < NUM_TILES / 4;
		return topSide ? ButtonSide.TOP : ButtonSide.BOTTOM;
	}

	//------------------------------------------------------------------------------

	private getButtonRotationDeg(button: Phaser.Sprite): number
	{
		var side = this.getButtonSide(button);
		switch (side)
		{
			case ButtonSide.TOP:	return 90;
			case ButtonSide.RIGHT:	return 180;
			case ButtonSide.BOTTOM: return 270;
			default:				return 0;
		}
	}

	//------------------------------------------------------------------------------

	private initButton(button: Phaser.Sprite)
	{
		button.body.immovable = true;
		this.setButtonPressed(button, false);
	}

	//------------------------------------------------------------------------------

	private setButtonPressed(button: Phaser.Sprite, pressed: boolean)
	{
		var body = button.body;
		body.width = 32;
		body.height = 32;
		body.offset.x = 0;
		body.offset.y = 0;

		// Set rotation (sort of - kludged)
		var side = this.getButtonSide(button);
		switch (side)
		{
			case ButtonSide.LEFT:
				button.frame = pressed ? 1 : 0;
				body.width = 14;
				break;
			case ButtonSide.TOP:
				button.frame = pressed ? 3 : 2;
				body.height = 14;
				break;
			case ButtonSide.RIGHT:
				button.frame = pressed ? 5 : 4;
				body.width = 14;
				body.offset.x = 18;
				break;
			case ButtonSide.BOTTOM:
				button.frame = pressed ? 7 : 6;
				body.height = 14;
				body.offset.y = 18;
				break;
		}

		(<IButton><any>button).isPressed = pressed;
	}

	//------------------------------------------------------------------------------

	private openDoor(door: Phaser.Sprite, doorTileType: number)
	{
		if (!game.player.openDoor(door, doorTileType))
			return;

		if (doorTileType === TILE_DOOR_UP)
		{
			this.tileMap.triggerLevelChange(+1);
			this.doorDownGroup.forEach(doorDown => PlayerEntity.setDoorClosed(doorDown), null);
		}
		else if ((<IDoor><any>door).isFinal)
			game.win();
		else
		{
			this.tileMap.triggerLevelChange(-1);
			this.doorUpGroup.forEach(doorUp => PlayerEntity.setDoorClosed(doorUp), null);
		}
	}

	//------------------------------------------------------------------------------

	public adjustDoors(closeDoorType: number)
	{
		var closeGroup = (closeDoorType === TILE_DOOR_DOWN) ? this.doorDownGroup : this.doorUpGroup;
		var openGroup = (closeDoorType === TILE_DOOR_DOWN) ? this.doorUpGroup : this.doorDownGroup;

		closeGroup.forEach(door => PlayerEntity.setDoorClosed(door), null);
		openGroup.forEach(door =>
		{
			if (!(<IDoor><any>door).isFinal)
				PlayerEntity.setDoorOpen(door);
		}, null);
	}

	//------------------------------------------------------------------------------

	public reset()
	{
		this.allGroups.forEach(
			group => group.children.forEach(
				displayObj =>
				{
					var resettable: IResettableSprite = (<IResettableSprite>displayObj);
					if (resettable.originalPos)
						resetAndShow(resettable);
				}));

		this.buttonGroup.forEach(button => this.setButtonPressed(button, false), null);
	}

	//------------------------------------------------------------------------------

	private tileMap: TileMapEntity;
	private layer: Phaser.TilemapLayer;
	public name: string;

	private breakableWallGroup: Phaser.Group;
	private holeGroup: Phaser.Group;
	private rockGroup: Phaser.Group;
	private keyGroup: Phaser.Group;
	private diamondGroup: Phaser.Group;
	private doorUpGroup: Phaser.Group;
	private doorDownGroup: Phaser.Group;
	private buttonGroup: Phaser.Group;
	private waterGroup: Phaser.Group;
	private allGroups: Phaser.Group[];
}

//------------------------------------------------------------------------------

interface IDoor
{
	isOpen: boolean;
	isFinal: boolean;
}

//------------------------------------------------------------------------------

interface IButton
{
	isPressed: boolean;
}

//------------------------------------------------------------------------------

interface IResettableSprite extends Phaser.Sprite
{
	originalPos: Phaser.Point;
}

//------------------------------------------------------------------------------

function makeResettableSprite(sprite: Phaser.Sprite)
{
	var resettable: IResettableSprite = <IResettableSprite>sprite;
	resettable.originalPos = sprite.position.clone();
}

//------------------------------------------------------------------------------

function hideSprite(sprite: Phaser.Sprite)
{
	sprite.visible = false;
	sprite.body.enable = false;
}

//------------------------------------------------------------------------------

function resetAndShow(sprite: IResettableSprite)
{
	sprite.position.setTo(sprite.originalPos.x, sprite.originalPos.y);
	sprite.visible = true;
	var body: Phaser.Physics.Arcade.Body = sprite.body;
	body.velocity.setTo(0, 0);
	body.acceleration.setTo(0, 0);
	body.gravity.setTo(0, 0);
	body.enable = true;
}

//------------------------------------------------------------------------------
