'use strict';

const EventEmitter = require('events');

/**
 * @property {object} config Default config for this quest, see individual quest types for details
 * @property {Player} player
 * @property {object} state  Current completion state
 * @extends EventEmitter
 */
class Quest extends EventEmitter {
  constructor(GameState, qid, config, player) {
    super();

    this.id = qid;
    this.config = Object.assign({
      title: 'Missing Quest Title',
      desc: 'Missing Quest Description',
      requires: [],
      level: 1,
      autoComplete: false,
      repeatable: false,
      reward: _ => {}
    }, config);

    this.player = player;
    this.goals = [];
    this.state = [];
    this.GameState = GameState;
  }

  /**
   * Proxy all events to all the goals
   * @param {string} event
   * @param {...*}   args
   */
  emit(event, ...args) {
    super.emit(event, ...args);

    if (event === 'progress') {
      // don't proxy progress event
      return;
    }

    this.goals.forEach(goal => {
      goal.emit(event, ...args);
    });
  }

  addGoal(goal) {
    this.goals.push(goal);
    goal.on('progress', () => this.onProgressUpdated());
  }

  /**
   * @fires Quest#turn-in-ready
   * @fires Quest#progress
   */
  onProgressUpdated() {
    const progress = this.getProgress();

    if (progress.percent >= 100) {
      if (this.config.autoComplete) {
        this.complete();
      } else {
        /**
         * @event Quest#turn-in-ready
         */
        this.emit('turn-in-ready');
      }
      return;
    }

    /**
     * @event Quest#progress
     * @param {object} progress
     */
    this.emit('progress', progress);
  }

  /**
   * @return {{ percent: number, display: string }}
   */
  getProgress() {
    let overallPercent = 0;
    let overallDisplay = [];
    this.goals.forEach(goal => {
      const goalProgress = goal.getProgress();
      overallPercent += goalProgress.percent;
      overallDisplay.push(goalProgress.display);
    });

    return {
      percent: Math.round(overallPercent / this.goals.length),
      display: overallDisplay.join('\r\n'),
    };
  }

  serialize() {
    return {
      state: this.goals.map(goal => goal.serialize()),
      progress: this.getProgress(),
      config: {
        desc: this.config.desc,
        level: this.config.level,
        title: this.config.title,
      },
    };
  }

  hydrate() {
    this.state.forEach((goalState, i) => {
      this.goals[i].hydrate(goalState.state);
    });
  }

  /**
   * @fires Quest#complete
   */
  complete() {
    /**
     * @event Quest#complete
     */
    this.emit('complete');
    this.goals.forEach(goal => {
      goal.complete();
    });
    this.config.reward(this, this.player);
  }
}

module.exports = Quest;
