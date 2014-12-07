/// 
/// LD31 entry: "Clockwise", by Schnerble.
///
/// Emitter classes
/// 
/// <reference path='phaser/phaser.d.ts'/>

//------------------------------------------------------------------------------

class BreakableWallEmitter
{
	constructor(x: number, y: number)
	{
		var emitter = game.add.emitter(x, y, 10);
		emitter.makeParticles('pebble');
		emitter.lifespan = 500;
		emitter.minParticleSpeed.setTo(-300, -190);
		emitter.maxParticleSpeed.setTo(300, 0);
		emitter.minParticleScale = 0.5;
		emitter.maxParticleScale = 1;
		emitter.gravity = 300;
		//emitter.autoAlpha = true;
		//emitter.setAlpha(0, 1, 1000);//, Phaser.Easing.Quadratic.Out(1));

		emitter.explode(3000, 10);

		this.emitter = emitter;
	}

	private emitter: Phaser.Particles.Arcade.Emitter;
}

//------------------------------------------------------------------------------

class FilledHoleEmitter
{
	constructor(x: number, y: number)
	{
		var emitter = game.add.emitter(x, y, 10);
		emitter.makeParticles('pebble');
		emitter.lifespan = 1000;
		emitter.minParticleSpeed.setTo(-100, -100);
		emitter.maxParticleSpeed.setTo(100, 0);
		emitter.minParticleScale = 0.3;
		emitter.maxParticleScale = 0.7;
		emitter.gravity = 300;
		//emitter.autoAlpha = true;
		//emitter.setAlpha(0, 1, 1000);//, Phaser.Easing.Quadratic.Out(1));

		emitter.explode(1000, 10);

		this.emitter = emitter;
	}

	private emitter: Phaser.Particles.Arcade.Emitter;
}

//------------------------------------------------------------------------------
