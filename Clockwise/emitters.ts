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
		emitter.makeParticles('turret');
		emitter.lifespan = 500;
		emitter.minParticleSpeed.setTo(-100, -50);
		emitter.maxParticleSpeed.setTo(100, 50);

		emitter.explode(2000, 10);

		this.emitter = emitter;
	}

	private emitter: Phaser.Particles.Arcade.Emitter;
}

//------------------------------------------------------------------------------
