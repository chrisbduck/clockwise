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
		//this.currentlayer = this.
		//this.currentLayer.visible = true;
		//this.currentLayer.debug = true;

		this.currentLayerIndex = layerIndex;

		//this.tileMap.setLayer(this.currentLayer);
		this.tileMap.setCollision(1);

		this.tileMap.setTileIndexCallback(3, () => this.triggerLevelChange(+1), null);
		this.tileMap.setTileIndexCallback(4, () => this.triggerLevelChange(-1), null);
		this.tileMap.setTileIndexCallback(5, () => this.breakWall(), null);
	}

	//------------------------------------------------------------------------------

	private breakWall()
	{
		if (this.walled)
			return;
		this.walled = true;

		console.log("broken wall");
		new BreakableWallEmitter(game.player.sprite.x, game.player.sprite.y);
	}

	//------------------------------------------------------------------------------

	private tileMap: Phaser.Tilemap;
	private name: string;
	//private tileLayers: Phaser.TilemapLayer[];
	private layers: TileMapLayerEntity[];
	//public currentLayer: Phaser.TilemapLayer;
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
	}

	//------------------------------------------------------------------------------

	public start()
	{
		this.layer.visible = true;
		this.layer.debug = true;
		this.layer.map.setLayer(this.layer);
	}

	//------------------------------------------------------------------------------

	public stop()
	{
		this.layer.visible = false;
	}

	//------------------------------------------------------------------------------

	public collideWith(spriteEntity: SpriteEntity)
	{
		game.physics.arcade.collide(spriteEntity.sprite, this.layer);
	}

	//------------------------------------------------------------------------------

	private layer: Phaser.TilemapLayer;
	private entities: Entity[];
}

//------------------------------------------------------------------------------
