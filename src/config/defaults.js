import { migrateCombatContent } from "../combat-content.js";
import { migrateSkillCards } from "../skill-cards.js";
import { migrateHeroRanks } from "../hero-ranks.js";
import { migrateHeroTags } from "../hero-tags.js";
import { migrateMarineContent } from "../marine-content.js";
import { migrateSeaArrivals } from "../sea-arrivals.js";
import { migrateHeroGrades } from "../hero-grades.js";
import { migrateMapPresets } from "../map-presets.js";
import { CATGIRL_CARD, HERO_CONTENT_VERSION } from "./hero-content.js";
import { migrateLevelGrowth } from "../level-stats.js";
import { migrateTerrain } from "../terrain.js";
import { migrateCritical } from "../critical.js";
import { migrateResourceContent } from "../resource-effects.js";
import { migrateRewards } from "../rewards.js";
import { migrateShops } from "../shop.js";
import { migrateAttackModules } from "../attack-modules.js";
import { migrateWorkshopContent } from "./workshop-content.js";
export const DEFAULT_CONFIG = {
  "heroContentVersion": HERO_CONTENT_VERSION,
  "version": 2,
  "name": "周五保卫战 · 默认规则",
  "initial": {
    "baseHp": 1000,
    "cards": {
      "hero_blue": 1,
      "hero_green": 1,
      "hero_purple": 1,
      "hero_catgirl": 1,
      "training": 2,
      "coffee": 2,
      "tower": 1,
      "fireball": 2,
      "lightning": 1,
      "quiver": 1,
      "guard": 1
    },
    "levelGrowth": {
      "maxHp": 65,
      "atk": 12,
      "heal": 100
    },
    "waveHeal": 0.25,
    "reviveHp": 0.5,
    "firstWaveDelay": 3
  },
  "cards": {
    "hero_blue": {
      "name": "阿蓝",
      "category": "hero",
      "target": "ground",
      "text": "近战先锋 · 放置英雄",
      "icon": "blue",
      "useIcon": "blue",
      "visual": "fireball",
      "effects": [],
      "unit": {
        "name": "阿蓝",
        "type": "blue",
        "maxHp": 360,
        "atk": 36,
        "range": 2,
        "rate": 1.4,
        "weapon": "",
        "speed": 5.2631578947368425
      },
      "triggerRules": [
        {
          "name": "开战成长",
          "enabled": true,
          "trigger": {
            "event": "battleStart",
            "scope": "any",
            "radius": -1
          },
          "target": {
            "kind": "self",
            "radius": -1,
            "count": 1
          },
          "effects": [
            {
              "type": "level",
              "value": 1
            }
          ]
        },
        {
          "name": "越战越勇",
          "enabled": true,
          "trigger": {
            "event": "heroBattleStart",
            "scope": "any",
            "radius": -1
          },
          "target": {
            "kind": "self",
            "radius": -1,
            "count": 1
          },
          "effects": [
            {
              "type": "stat",
              "stat": "speed",
              "mode": "add",
              "value": 0.5,
              "duration": "day"
            }
          ]
        }
      ]
    },
    "hero_green": {
      "name": "小叶",
      "category": "hero",
      "target": "ground",
      "text": "远程弓手 · 放置英雄",
      "icon": "green",
      "useIcon": "green",
      "visual": "fireball",
      "effects": [],
      "unit": {
        "name": "小叶",
        "type": "green",
        "weapon": "bow",
        "maxHp": 220,
        "atk": 27,
        "range": 4,
        "rate": 1.3,
        "speed": 5.2631578947368425
      },
      "triggerRules": [
        {
          "name": "并肩作战",
          "enabled": true,
          "trigger": {
            "event": "battleStart",
            "scope": "any",
            "radius": -1
          },
          "target": {
            "kind": "selfAndNearest",
            "radius": -1,
            "count": 1
          },
          "effects": [
            {
              "type": "stat",
              "stat": "rate",
              "mode": "add",
              "value": 0.2,
              "duration": "day"
            }
          ]
        }
      ]
    },
    "hero_purple": {
      "name": "咕咕",
      "category": "hero",
      "target": "ground",
      "text": "溅射法师 · 放置英雄",
      "icon": "purple",
      "useIcon": "purple",
      "visual": "fireball",
      "effects": [],
      "unit": {
        "name": "咕咕",
        "type": "purple",
        "weapon": "staff",
        "maxHp": 190,
        "atk": 44,
        "range": 3,
        "rate": 0.8,
        "speed": 5.2631578947368425
      },
      "triggerRules": [
        {
          "name": "战意回响",
          "enabled": true,
          "trigger": {
            "event": "battleStart",
            "scope": "any",
            "radius": -1
          },
          "target": {
            "kind": "nearest",
            "radius": -1,
            "count": 1
          },
          "effects": [
            {
              "type": "triggerBattleStart"
            }
          ]
        }
      ]
    },
    "hero_catgirl": structuredClone(CATGIRL_CARD),
    "training": {
      "name": "实战心得",
      "category": "resource",
      "target": "hero",
      "text": "英雄等级 +1",
      "icon": "training",
      "useIcon": "training",
      "visual": "fireball",
      "effects": [
        {
          "type": "level",
          "value": 1
        }
      ]
    },
    "coffee": {
      "name": "热咖啡",
      "category": "resource",
      "target": "hero",
      "text": "恢复 120 生命",
      "icon": "coffee",
      "useIcon": "coffee",
      "visual": "fireball",
      "effects": [
        {
          "type": "heal",
          "value": 120
        }
      ]
    },
    "tower": {
      "name": "咖啡炮台",
      "category": "resource",
      "target": "ground",
      "text": "放置自动炮台",
      "icon": "tower",
      "useIcon": "tower",
      "visual": "fireball",
      "effects": [
        {
          "type": "summon"
        }
      ],
      "unit": {
        "type": "tower",
        "maxHp": 260,
        "atk": 24,
        "range": 4,
        "rate": 1,
        "speed": 1,
        "weapon": "coffeeCannon"
      }
    },
    "fireball": {
      "name": "爆裂火球",
      "category": "battle",
      "target": "area",
      "text": "小范围 · 110 伤害",
      "icon": "fireball",
      "useIcon": "fireball",
      "visual": "fireball",
      "effects": [
        {
          "type": "damage",
          "value": 110,
          "radius": 1
        }
      ]
    },
    "lightning": {
      "name": "落雷",
      "category": "battle",
      "target": "enemy",
      "text": "单体 · 240 伤害",
      "icon": "lightning",
      "useIcon": "lightning",
      "visual": "lightning",
      "effects": [
        {
          "type": "damage",
          "value": 240,
          "radius": 0
        }
      ]
    },
    "frost": {
      "name": "寒霜冲击",
      "category": "battle",
      "target": "area",
      "text": "范围伤害 · 减速 3 秒",
      "icon": "frost",
      "useIcon": "frost",
      "visual": "frost",
      "effects": [
        {
          "type": "damage",
          "value": 45,
          "radius": 2
        },
        {
          "type": "slow",
          "value": 0.55,
          "duration": 3,
          "radius": 2
        }
      ]
    },
    "quiver": {
      "name": "鹰眼箭袋",
      "category": "equipment",
      "target": "hero",
      "text": "攻击 +8 · 射程 +1",
      "icon": "quiver",
      "useIcon": "quiver",
      "visual": "fireball",
      "effects": [
        {
          "type": "stat",
          "stat": "atk",
          "mode": "add",
          "value": 8
        },
        {
          "type": "stat",
          "stat": "range",
          "mode": "add",
          "value": 1
        }
      ]
    },
    "haste": {
      "name": "疾风徽章",
      "category": "equipment",
      "target": "hero",
      "text": "攻击速度 +25%",
      "icon": "haste",
      "useIcon": "haste",
      "visual": "fireball",
      "effects": [
        {
          "type": "stat",
          "stat": "rate",
          "mode": "multiply",
          "value": 1.25
        }
      ]
    },
    "vampire": {
      "name": "饮血吊坠",
      "category": "equipment",
      "target": "hero",
      "text": "攻击吸血 15%",
      "icon": "vampire",
      "useIcon": "vampire",
      "visual": "fireball",
      "effects": [
        {
          "type": "lifesteal",
          "value": 0.15
        }
      ]
    },
    "guard": {
      "name": "守护护符",
      "category": "equipment",
      "target": "hero",
      "text": "受到伤害减少 25%",
      "icon": "guard",
      "useIcon": "guard",
      "visual": "fireball",
      "effects": [
        {
          "type": "mitigation",
          "value": 0.25
        }
      ]
    },
    "arcane": {
      "name": "星辉法杖",
      "category": "equipment",
      "target": "hero",
      "text": "装备法杖 · 获得溅射",
      "icon": "arcane",
      "useIcon": "arcane",
      "visual": "fireball",
      "effects": [
        {
          "type": "weapon",
          "weapon": "staff",
          "range": 3
        }
      ]
    }
  },
  "enemies": {
    "grunt": {
      "name": "加班小兵",
      "type": "grunt",
      "useIcon": "grunt",
      "maxHp": 80,
      "atk": 12,
      "range": 1,
      "rate": 0.7,
      "speed": 0.6,
      "weapon": ""
    },
    "runner": {
      "name": "催稿蜘蛛",
      "type": "runner",
      "useIcon": "runner",
      "maxHp": 58,
      "atk": 9,
      "range": 1,
      "rate": 1.1,
      "speed": 1.25,
      "weapon": ""
    },
    "tank": {
      "name": "会议重甲",
      "type": "tank",
      "useIcon": "tank",
      "maxHp": 210,
      "atk": 23,
      "range": 1,
      "rate": 0.6,
      "speed": 0.45,
      "weapon": ""
    },
    "boss": {
      "name": "周五临时需求",
      "type": "boss",
      "useIcon": "boss",
      "maxHp": 950,
      "atk": 45,
      "range": 1,
      "rate": 0.75,
      "speed": 0.38,
      "weapon": ""
    }
  },
  "days": [
    {
      "id": "wave_1",
      "name": "“就占用你五分钟”",
      "desc": "加班小兵 · 从四个方向出现",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_green": 1,
            "haste": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1,
          "atkScale": 1,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.2,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.4,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.5999999999999996,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1,
          "atkScale": 1,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.2,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.4,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.5999999999999996,
              "interval": 4.8,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "wave_2",
      "name": "“这个需求很简单”",
      "desc": "催稿蜘蛛加入 · 移动速度更快",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_purple": 1,
            "vampire": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1.13,
          "atkScale": 1.08,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.1099999999999999,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.2199999999999998,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.3299999999999996,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1.13,
          "atkScale": 1.08,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.1099999999999999,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.2199999999999998,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.3299999999999996,
              "interval": 4.4399999999999995,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "wave_3",
      "name": "“下班前再改一版”",
      "desc": "会议重甲加入 · 高生命值",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_blue": 1,
            "arcane": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1.26,
          "atkScale": 1.16,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.02,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.04,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.06,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1.26,
          "atkScale": 1.16,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 1.02,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 2.04,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 3.06,
              "interval": 4.08,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "wave_4",
      "name": "“大家再坚持一下”",
      "desc": "四面围攻 · 注意保护侧翼",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_green": 1,
            "quiver": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1.3900000000000001,
          "atkScale": 1.24,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.9299999999999999,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.8599999999999999,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.79,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1.3900000000000001,
          "atkScale": 1.24,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.9299999999999999,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.8599999999999999,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.79,
              "interval": 3.7199999999999998,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "wave_5",
      "name": "“周末方便带电脑吗”",
      "desc": "重甲大军 · 建塔分担火力",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_purple": 1,
            "guard": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1.52,
          "atkScale": 1.32,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.84,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.68,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.52,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1.52,
          "atkScale": 1.32,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.84,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.68,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.52,
              "interval": 3.36,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "wave_6",
      "name": "“周五临时需求”",
      "desc": "最终首领来袭 · 守住你的周末",
      "rewards": [
        {
          "name": "战地补给",
          "theme": "resource",
          "cards": {
            "training": 2,
            "coffee": 2,
            "tower": 1
          }
        },
        {
          "name": "火力支援",
          "theme": "battle",
          "cards": {
            "fireball": 2,
            "lightning": 2,
            "frost": 1
          }
        },
        {
          "name": "精锐增援",
          "theme": "equipment",
          "cards": {
            "hero_blue": 1,
            "haste": 1,
            "training": 1
          }
        }
      ],
      "waves": [
        {
          "id": "wave_1",
          "name": "先遣队",
          "startDelay": 0,
          "hpScale": 1.65,
          "atkScale": 1.4,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.75,
              "interval": 3,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.5,
              "interval": 3,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.25,
              "interval": 3,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            }
          ]
        },
        {
          "id": "wave_2",
          "name": "增援来袭",
          "startDelay": 5,
          "hpScale": 1.65,
          "atkScale": 1.4,
          "spawns": [
            {
              "x": 7,
              "y": 0,
              "delay": 0,
              "interval": 3,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "boss",
                  "count": 1
                }
              ]
            },
            {
              "x": 14,
              "y": 5,
              "delay": 0.75,
              "interval": 3,
              "enemies": [
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                }
              ]
            },
            {
              "x": 7,
              "y": 10,
              "delay": 1.5,
              "interval": 3,
              "enemies": [
                {
                  "type": "tank",
                  "count": 1
                },
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                }
              ]
            },
            {
              "x": 0,
              "y": 5,
              "delay": 2.25,
              "interval": 3,
              "enemies": [
                {
                  "type": "grunt",
                  "count": 1
                },
                {
                  "type": "runner",
                  "count": 1
                },
                {
                  "type": "tank",
                  "count": 1
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
migrateLevelGrowth(DEFAULT_CONFIG);
migrateTerrain(DEFAULT_CONFIG);
migrateCritical(DEFAULT_CONFIG);
migrateResourceContent(DEFAULT_CONFIG);
migrateRewards(DEFAULT_CONFIG);
migrateShops(DEFAULT_CONFIG);
migrateAttackModules(DEFAULT_CONFIG);
// Keep the new card available in fresh games and portable default exports.
migrateWorkshopContent(DEFAULT_CONFIG);

migrateHeroGrades(DEFAULT_CONFIG);
migrateMapPresets(DEFAULT_CONFIG);

migrateMarineContent(DEFAULT_CONFIG);
migrateSeaArrivals(DEFAULT_CONFIG);

migrateCombatContent(DEFAULT_CONFIG);
migrateSkillCards(DEFAULT_CONFIG);
migrateHeroRanks(DEFAULT_CONFIG);
migrateHeroTags(DEFAULT_CONFIG);
