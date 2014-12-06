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
	constructor(x: number, y: number)
	{
		super(x, y, 'ship');
		game.physics.arcade.enable(this.sprite);

		this.cursorKeys = game.input.keyboard.createCursorKeys();
	}

	//------------------------------------------------------------------------------

	public update()
	{
		var vel = this.sprite.body.velocity;

		vel.x = 0;
		if (this.cursorKeys.right.isDown)
			vel.x = 300;
		else if (this.cursorKeys.left.isDown)
			vel.x = -300;

		vel.y = 0;
		if (this.cursorKeys.up.isDown)
			vel.y = -300;
		else if (this.cursorKeys.down.isDown)
			vel.y = 300;
	}

	//------------------------------------------------------------------------------

	private cursorKeys: Phaser.CursorKeys;
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

		layer.map.createFromTiles(TILE_BREAKABLE_WALL, -1, 'breakable', layer, this.group);
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
		arcadePhysics.collide(player.sprite, this.layer);

		arcadePhysics.overlap(player.sprite, this.group, this.breakWall, null, this);
	}

	//------------------------------------------------------------------------------

	private breakWall(playerSprite: Phaser.Sprite, wall: Phaser.Sprite)
	{
		new BreakableWallEmitter(wall.x, wall.y);
		wall.kill();
	}

	//------------------------------------------------------------------------------

	private layer: Phaser.TilemapLayer;
	private group: Phaser.Group;
	private entities: Entity[];
}

//------------------------------------------------------------------------------
