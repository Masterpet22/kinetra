import { addAnimationOffsets, sampleKeyframeAnimationPose, TRANSFORM_PROPERTIES } from "./runtime.js";

const ANIMATION_PRIORITIES = Object.freeze({
  idle: 10,
  locomotion: 20,
  action: 30,
  hit: 40,
  defeated: 50
});

function targetFor(fighter, name) {
  if (name === "torso") return fighter.sprite;
  if (name === "body" || name === "rig" || name === "shadow") return fighter[name];
  return fighter.joints?.[name] || null;
}

function snapshot(target) {
  return Object.fromEntries(
    TRANSFORM_PROPERTIES.map((property) => [
      property,
      Number(target?.[property] ?? (property.startsWith("scale") || property === "alpha" ? 1 : 0))
    ])
  );
}

export class PuppetAnimationController {
  constructor(scene, fighter, clips = {}) {
    this.scene = scene;
    this.fighter = fighter;
    this.clips = clips;
    this.current = null;
    this.tweens = [];
    this.touched = new Map();
    this.neutral = new Map();
    this.finished = Promise.resolve(true);
    this.resolveFinished = null;
    this.generation = 0;
  }

  get state() {
    return this.current?.state || null;
  }
  get clipId() {
    return this.current?.id || null;
  }

  supports(idOrClip) {
    const clip = typeof idOrClip === "string" ? this.clips[idOrClip] : idOrClip;
    return Boolean(clip?.requires?.every((name) => targetFor(this.fighter, name)));
  }

  canPlay(clip) {
    if (!this.current) return true;
    return ANIMATION_PRIORITIES[clip.state] >= ANIMATION_PRIORITIES[this.current.state];
  }

  play(id, { force = false, timeScale = 1 } = {}) {
    const clip = this.clips[id];
    if (!clip) throw new Error(`Clip de animación desconocido: ${id}`);
    if (!this.supports(clip)) return false;
    if (this.current?.id === id) return true;
    if (!force && !this.canPlay(clip)) return false;
    this.stop({ reset: true });
    this.current = clip;
    const generation = this.generation;
    return this.playKeyframeClip(clip, { generation, timeScale });
  }

  playKeyframeClip(clip, { generation, timeScale }) {
    const targets = new Map();
    Object.keys(clip.keys).forEach((name) => {
      const target = targetFor(this.fighter, name);
      if (!target) return;
      const base = this.neutral.get(target) || snapshot(target);
      this.neutral.set(target, base);
      this.touched.set(target, base);
      targets.set(name, { target, base });
    });

    const applyAt = (elapsed) => {
      const pose = sampleKeyframeAnimationPose(clip, elapsed);
      Object.entries(pose).forEach(([name, offsets]) => {
        const entry = targets.get(name);
        if (entry) Object.assign(entry.target, addAnimationOffsets(entry.base, offsets));
      });
    };

    applyAt(0);
    const clock = { elapsed: 0 };
    this.finished = new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
    const tween = this.scene.tweens.add({
      targets: clock,
      elapsed: clip.duration,
      duration: Math.max(1, clip.duration / timeScale),
      ease: "Linear",
      repeat: clip.loop ? -1 : 0,
      onUpdate: () => applyAt(clock.elapsed),
      onComplete: clip.loop
        ? undefined
        : () => {
            applyAt(clip.duration);
            if (generation === this.generation) this.complete();
          }
    });
    this.tweens.push(tween);
    return true;
  }

  loop(id, options) {
    return this.play(id, options);
  }

  async playOnce(id, options) {
    if (!this.play(id, options)) return false;
    return this.finished;
  }

  complete() {
    const resolve = this.resolveFinished;
    this.tweens = [];
    if (this.current?.restore !== false) this.touched.forEach((base, target) => Object.assign(target, base));
    this.touched.clear();
    this.current = null;
    this.resolveFinished = null;
    resolve?.(true);
  }

  stop({ reset = true } = {}) {
    this.generation += 1;
    this.tweens.forEach((tween) => tween?.stop());
    this.tweens = [];
    if (reset) this.touched.forEach((base, target) => Object.assign(target, base));
    this.touched.clear();
    this.current = null;
    this.resolveFinished?.(false);
    this.resolveFinished = null;
  }
}

export function createPuppetAnimationController(scene, fighter) {
  return new PuppetAnimationController(scene, fighter);
}
