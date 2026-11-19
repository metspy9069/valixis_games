// Road Riot 3D - Progression, Settings, Achievements & Viral Challenge Engine

export const ACHIEVEMENTS = [
  { id: 'first_burnout', title: 'First Burnout', desc: 'Complete your first run on the highway.', reward: 150, icon: '🏁' },
  { id: 'mach_speeder', title: 'Mach Speeder', desc: 'Break the speed limit and reach 280+ KM/H.', reward: 300, icon: '⚡' },
  { id: 'drift_master', title: 'Drift Master', desc: 'Score 1,000 drift points in a single run.', reward: 400, icon: '🏎️' },
  { id: 'needle_threader', title: 'Threading the Needle', desc: 'Execute 15 Near Misses in a single run.', reward: 500, icon: '🎯' },
  { id: 'stunt_driver', title: 'Stunt Driver', desc: 'Launch off 5 Stunt Jump Ramps.', reward: 400, icon: '🚀' },
  { id: 'highway_enforcer', title: 'Highway Enforcer', desc: 'Demolish 10 vehicles with weapons or ramming.', reward: 600, icon: '💥' },
  { id: 'untouchable', title: 'Untouchable', desc: 'Survive 3,000m without taking hull damage.', reward: 750, icon: '🛡️' },
  { id: 'rival_vanquisher', title: 'Rival Vanquisher', desc: 'Conquer a friend\'s challenger beacon.', reward: 1000, icon: '🏆' }
];

export class ProgressionManager {
  constructor() {
    this.storageKey = 'valixis_roadriot_save_v2';
    this.data = this.loadData();
    this.activeRunStats = {
      distance: 0,
      score: 0,
      topSpeed: 0,
      nearMisses: 0,
      combos: 0,
      coinsEarned: 0,
      vehiclesDestroyed: 0,
      driftPoints: 0,
      rampsJumped: 0,
      damageTaken: 0
    };

    this.checkDailyReset();
  }

  getDefaultData() {
    return {
      coins: 300, // Starter bonus
      highScore: 0,
      bestDistance: 0,
      bestTopSpeed: 0,
      totalRuns: 0,
      selectedVehicle: 'apex',
      selectedPaint: 0xd71920,
      selectedGlow: 0x00d9ff,
      unlockedVehicles: ['apex'],
      upgrades: {
        apex: { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 },
        venom: { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 },
        titan: { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 },
        phantom: { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 },
        hyperion: { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 }
      },
      settings: {
        masterVolume: 0.85,
        engineVolume: 0.75,
        sfxVolume: 0.85,
        musicVolume: 0.50,
        steeringSensitivity: 1.0,
        mouseSteerEnabled: false,
        gamepadRumbleEnabled: true,
        graphicsQuality: 'high' // 'high', 'med', 'low'
      },
      unlockedAchievements: [],
      lastDailyDate: '',
      dailyQuests: [
        { id: 'near_miss', desc: 'Pull off 8 Near Misses', target: 8, current: 0, reward: 300, claimed: false },
        { id: 'top_speed', desc: 'Reach 270 KM/H in Nitro', target: 270, current: 0, reward: 250, claimed: false },
        { id: 'distance', desc: 'Reach 3,500m in a single run', target: 3500, current: 0, reward: 450, claimed: false }
      ]
    };
  }

  loadData() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const def = this.getDefaultData();
          return {
            ...def,
            ...parsed,
            settings: { ...def.settings, ...(parsed.settings || {}) },
            upgrades: { ...def.upgrades, ...(parsed.upgrades || {}) }
          };
        }
      }
    } catch (e) {}
    return this.getDefaultData();
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      }
    } catch (e) {}
  }

  checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.lastDailyDate !== today) {
      this.data.lastDailyDate = today;
      this.data.dailyQuests = [
        { id: 'near_miss', desc: 'Pull off 10 Near Misses', target: 10, current: 0, reward: 350, claimed: false },
        { id: 'coins', desc: 'Collect 40 Gold Coins', target: 40, current: 0, reward: 300, claimed: false },
        { id: 'distance', desc: 'Survive 4,000m on the Highway', target: 4000, current: 0, reward: 500, claimed: false }
      ];
      this.save();
    }
  }

  unlockVehicle(vehicleId, cost) {
    if (this.data.coins >= cost && !this.data.unlockedVehicles.includes(vehicleId)) {
      this.data.coins -= cost;
      this.data.unlockedVehicles.push(vehicleId);
      this.data.selectedVehicle = vehicleId;
      this.save();
      return true;
    }
    return false;
  }

  upgradeStat(vehicleId, statName, cost) {
    if (!this.data.upgrades[vehicleId]) {
      this.data.upgrades[vehicleId] = { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 };
    }
    const currentLvl = this.data.upgrades[vehicleId][statName] || 0;
    if (currentLvl < 5 && this.data.coins >= cost) {
      this.data.coins -= cost;
      this.data.upgrades[vehicleId][statName] = currentLvl + 1;
      this.save();
      return true;
    }
    return false;
  }

  resetRunStats() {
    this.activeRunStats = {
      distance: 0,
      score: 0,
      topSpeed: 0,
      nearMisses: 0,
      combos: 0,
      coinsEarned: 0,
      vehiclesDestroyed: 0,
      driftPoints: 0,
      rampsJumped: 0,
      damageTaken: 0
    };
  }

  recordRunEnd() {
    const s = this.activeRunStats;
    this.data.totalRuns++;
    this.data.coins += s.coinsEarned;

    if (s.score > this.data.highScore) {
      this.data.highScore = s.score;
    }
    if (s.distance > this.data.bestDistance) {
      this.data.bestDistance = Math.floor(s.distance);
    }
    if (s.topSpeed > this.data.bestTopSpeed) {
      this.data.bestTopSpeed = Math.floor(s.topSpeed);
    }

    // Check Daily Quests
    this.data.dailyQuests.forEach(q => {
      if (q.id === 'near_miss') q.current = Math.min(q.target, q.current + s.nearMisses);
      if (q.id === 'coins') q.current = Math.min(q.target, q.current + s.coinsEarned);
      if (q.id === 'distance') q.current = Math.max(q.current, Math.min(q.target, Math.floor(s.distance)));
      if (q.id === 'top_speed') q.current = Math.max(q.current, Math.min(q.target, Math.floor(s.topSpeed)));
    });

    // Check Achievements on run finish
    this.checkAchievements();
    this.save();
  }

  checkAchievements() {
    const s = this.activeRunStats;
    const unlocked = [];

    if (this.data.totalRuns >= 1) unlocked.push(this.unlockAchievement('first_burnout'));
    if (s.topSpeed >= 280) unlocked.push(this.unlockAchievement('mach_speeder'));
    if (s.driftPoints >= 1000) unlocked.push(this.unlockAchievement('drift_master'));
    if (s.nearMisses >= 15) unlocked.push(this.unlockAchievement('needle_threader'));
    if (s.rampsJumped >= 5) unlocked.push(this.unlockAchievement('stunt_driver'));
    if (s.vehiclesDestroyed >= 10) unlocked.push(this.unlockAchievement('highway_enforcer'));
    if (s.distance >= 3000 && s.damageTaken === 0) unlocked.push(this.unlockAchievement('untouchable'));

    return unlocked.filter(Boolean);
  }

  unlockAchievement(id) {
    if (!this.data.unlockedAchievements) this.data.unlockedAchievements = [];
    if (!this.data.unlockedAchievements.includes(id)) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        this.data.unlockedAchievements.push(id);
        this.data.coins += ach.reward;
        this.save();
        return ach;
      }
    }
    return null;
  }

  claimQuest(questId) {
    const q = this.data.dailyQuests.find(item => item.id === questId);
    if (q && !q.claimed && q.current >= q.target) {
      q.claimed = true;
      this.data.coins += q.reward;
      this.save();
      return q.reward;
    }
    return 0;
  }

  getRank(distance) {
    if (distance >= 15000) return { title: 'S+ RANK HIGHWAY LEGEND', color: '#ffb800' };
    if (distance >= 10000) return { title: 'SPEED DEMON', color: '#ff2a85' };
    if (distance >= 6000) return { title: 'CYBER DRIFTER', color: '#9d4edd' };
    if (distance >= 3000) return { title: 'HIGHWAY OUTLAW', color: '#00d9ff' };
    if (distance >= 1200) return { title: 'STREET RACER', color: '#00ff88' };
    return { title: 'ROOKIE SPEEDER', color: '#8fa0b5' };
  }

  // --- VIRAL CHALLENGE & SOCIAL SHARING ---
  getChallengeDataFromUrl() {
    if (typeof window === 'undefined' || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    const challenge = params.get('challenge');
    const name = params.get('name') || 'Rival';
    if (challenge && !isNaN(parseInt(challenge, 10))) {
      return {
        distance: parseInt(challenge, 10),
        name: decodeURIComponent(name).slice(0, 16)
      };
    }
    return null;
  }

  generateShareUrl(distance, score) {
    const base = 'https://games.valixis.tech/road-riot/';
    const name = encodeURIComponent('Rival');
    return `${base}?challenge=${Math.floor(distance)}&score=${score}&name=${name}`;
  }

  getShareText(distance, score, topSpeed) {
    return `🚗 I just clocked ${Math.floor(distance)}m at ${Math.round(topSpeed)} KM/H in Road Riot 3D on VALIXIS Games! Can you beat my score? Play free: ${this.generateShareUrl(distance, score)}`;
  }
}

export const progression = new ProgressionManager();
