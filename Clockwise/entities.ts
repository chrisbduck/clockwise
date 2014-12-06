/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Entity classes
/// 
/// <reference path='phaser/phaser.d.ts'/>

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
	constructor(tilemap: string, tileset: string, triggerCallback: () => void)
	{
		super();

		this.name = tilemap;

		this.tileMap = game.add.tilemap(tilemap);
		this.tileMap.addTilesetImage(tileset);
		this.tileLayers = [];
		this.tileLayers.push(this.tileMap.createLayer("Tile Layer 1"));
		this.tileLayers.push(this.tileMap.createLayer("Tile Layer 2"));
		this.tileLayers.forEach(layer => layer.visible = false);

		this.currentLayer = null;
		this.triggerCallback = triggerCallback;
		this.switchTo(0);
	}

	//------------------------------------------------------------------------------

	public update()
	{
	}

	//------------------------------------------------------------------------------

	public nextLayer()
	{
		this.switchTo((this.currentLayerIndex === 0) ? 1 : 0);
	}

	//------------------------------------------------------------------------------

	private switchTo(layerIndex: number)
	{
		console.log(this.name, "switching to", layerIndex);
		if (this.currentLayer)
			this.currentLayer.visible = false;

		this.currentLayer = this.tileLayers[layerIndex];
		this.currentLayer.visible = true;
		this.currentLayer.debug = true;

		this.currentLayerIndex = layerIndex;
		this.callbackTriggered = false;

		this.tileMap.setLayer(this.currentLayer);
		this.tileMap.setCollisionBetween(0, 1);

		this.tileMap.setTileIndexCallback(3, () =>
		{
			if (this.callbackTriggered)
				return;
			this.callbackTriggered = true;
			this.triggerCallback();
		}, null);
	}

	//------------------------------------------------------------------------------

	private trigger()
	{

	}

	//------------------------------------------------------------------------------

	private tileMap: Phaser.Tilemap;
	private name: string;
	private tileLayers: Phaser.TilemapLayer[];
	public currentLayer: Phaser.TilemapLayer;
	private currentLayerIndex: number;
	private triggerCallback: () => void;
	private callbackTriggered: boolean;
}

//------------------------------------------------------------------------------
