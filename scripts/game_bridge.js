/**
 * QQFramBot Game Bridge v2
 *
 * 通过 Cocos Creator 内部组件 API 操控 QQ 农场。
 * 核心组件：PlantInteractiveComp（种植交互）、OneClickOperationBtnComp（一键操作）
 */
(function () {
  'use strict';
  if (window.__qqframbot_bridge__) return 'bridge_already_loaded';
  window.__qqframbot_bridge__ = true;

  function getScene() { return cc.director.getScene(); }

  function getFarmMap() {
    return cc.find('root/scene/farm_scene_v3', getScene()).getComponent('FarmMapComp');
  }

  function getPlantInteractive() {
    return cc.find('root/ui/LayerUI/plant_interactive_v2', getScene()).getComponent('PlantInteractiveComp');
  }

  function getOneClick() {
    return cc.find('root/ui/LayerUI/main_ui_v2/foot/LoadLazyRoot/OneClickOperationTools', getScene())
      .getComponent('OneClickOperationBtnComp');
  }

  var Bridge = {
    /** 获取当前场景名 */
    getSceneName: function () {
      return getScene().name;
    },

    /** 获取所有可操作地块 ID */
    getActionableLands: function () {
      var ock = getOneClick();
      return {
        harvestable: ock.getAllHarvestableLandIds(),
        waterable: ock.getAllWaterableLandIds(),
        killBug: ock.getAllKillBugLandIds(),
        eraseGrass: ock.getAllEraseGrassLandIds(),
      };
    },

    /** 获取所有地块完整状态 */
    getAllLandStatus: function () {
      var scene = getScene();
      var lands = [];
      var now = Math.floor(Date.now() / 1000);

      for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 6; y++) {
          var gridNode = cc.find('root/scene/farm_scene_v3/Scaled/Rotate/GridOrigin/grid_' + x + '_' + y, scene);
          if (!gridNode) continue;

          var lc = gridNode.getComponent('LandComp');
          var ld = lc.getLandData ? lc.getLandData() : lc.landCellData;

          var plantNode = cc.find('root/scene/farm_scene_v3/PlantOrigin/plant_grid_' + x + '_' + y, scene);
          var pc = plantNode ? plantNode.getComponent('PlantComp') : null;
          var pd = pc && pc.plantData ? pc.plantData : null;
          var hasPlant = !!(pd && pd.plantData);

          var land = {
            grid: [x, y],
            landId: ld && ld.landData ? ld.landData.id : null,
            level: ld && ld.landData ? ld.landData.landLevel : null,
            hasPlant: hasPlant,
          };

          if (hasPlant) {
            var p = pd.plantData;
            var cfg = pd.config;
            land.plant = {
              name: cfg.name,
              season: p.season + '/' + cfg.seasons,
              curPhase: p.curPhaseId,
              fruitNum: p.left_fruit_num,
              weeds: p.weeds_num,
              insects: p.insects_num,
              stealable: p.stealable,
            };
          }

          lands.push(land);
        }
      }
      return lands;
    },

    /** 点击指定地块（弹出交互面板） */
    clickLand: function (gridX, gridY) {
      var scene = getScene();
      var gridNode = cc.find('root/scene/farm_scene_v3/Scaled/Rotate/GridOrigin/grid_' + gridX + '_' + gridY, scene);
      if (!gridNode) return { error: 'land not found' };
      var lc = gridNode.getComponent('LandComp');
      lc.showPlantInteraction();
      return { ok: true, grid: [gridX, gridY] };
    },

    /** 收获指定地块 */
    harvest: function (gridX, gridY) {
      this.clickLand(gridX, gridY);
      var pi = getPlantInteractive();
      if (pi.checkCanHarvest()) {
        pi.performHarvesting();
        return { ok: true, action: 'harvest', grid: [gridX, gridY] };
      }
      return { error: 'cannot harvest', grid: [gridX, gridY] };
    },

    /** 浇水指定地块 */
    water: function (gridX, gridY) {
      this.clickLand(gridX, gridY);
      var pi = getPlantInteractive();
      if (pi.canWater()) {
        pi.performWatering();
        return { ok: true, action: 'water', grid: [gridX, gridY] };
      }
      return { error: 'cannot water', grid: [gridX, gridY] };
    },

    /** 施肥指定地块 */
    fertilize: function (gridX, gridY) {
      this.clickLand(gridX, gridY);
      var pi = getPlantInteractive();
      if (pi.canFertilize()) {
        pi.performFertilizing();
        return { ok: true, action: 'fertilize', grid: [gridX, gridY] };
      }
      return { error: 'cannot fertilize', grid: [gridX, gridY] };
    },

    /** 杀虫指定地块 */
    killBug: function (gridX, gridY) {
      this.clickLand(gridX, gridY);
      var pi = getPlantInteractive();
      if (pi.canKillBug()) {
        pi.performBugKilling();
        return { ok: true, action: 'killBug', grid: [gridX, gridY] };
      }
      return { error: 'cannot kill bug', grid: [gridX, gridY] };
    },

    /** 除草指定地块 */
    eraseGrass: function (gridX, gridY) {
      this.clickLand(gridX, gridY);
      var pi = getPlantInteractive();
      if (pi.canEraseGrass()) {
        pi.performGrassEraser();
        return { ok: true, action: 'eraseGrass', grid: [gridX, gridY] };
      }
      return { error: 'cannot erase grass', grid: [gridX, gridY] };
    },

    /** 一键收获所有成熟作物 */
    harvestAll: function () {
      var ids = getOneClick().getAllHarvestableLandIds();
      if (ids.length === 0) return { harvested: 0 };
      var farm = getFarmMap();
      var results = [];
      for (var i = 0; i < ids.length; i++) {
        var lc = farm.getLandCompByLandId(ids[i]);
        if (lc) {
          lc.showPlantInteraction();
          var pi = getPlantInteractive();
          if (pi.checkCanHarvest()) {
            pi.performHarvesting();
            results.push(ids[i]);
          }
        }
      }
      return { harvested: results.length, landIds: results };
    },

    /** 一键浇水所有缺水地块 */
    waterAll: function () {
      var ids = getOneClick().getAllWaterableLandIds();
      if (ids.length === 0) return { watered: 0 };
      var farm = getFarmMap();
      var results = [];
      for (var i = 0; i < ids.length; i++) {
        var lc = farm.getLandCompByLandId(ids[i]);
        if (lc) {
          lc.showPlantInteraction();
          var pi = getPlantInteractive();
          if (pi.canWater()) {
            pi.performWatering();
            results.push(ids[i]);
          }
        }
      }
      return { watered: results.length, landIds: results };
    },

    /** 一键除虫所有有虫地块 */
    killBugAll: function () {
      var ids = getOneClick().getAllKillBugLandIds();
      if (ids.length === 0) return { killed: 0 };
      var farm = getFarmMap();
      var results = [];
      for (var i = 0; i < ids.length; i++) {
        var lc = farm.getLandCompByLandId(ids[i]);
        if (lc) {
          lc.showPlantInteraction();
          var pi = getPlantInteractive();
          if (pi.canKillBug()) {
            pi.performBugKilling();
            results.push(ids[i]);
          }
        }
      }
      return { killed: results.length, landIds: results };
    },

    /** 一键除草所有有草地块 */
    eraseGrassAll: function () {
      var ids = getOneClick().getAllEraseGrassLandIds();
      if (ids.length === 0) return { erased: 0 };
      var farm = getFarmMap();
      var results = [];
      for (var i = 0; i < ids.length; i++) {
        var lc = farm.getLandCompByLandId(ids[i]);
        if (lc) {
          lc.showPlantInteraction();
          var pi = getPlantInteractive();
          if (pi.canEraseGrass()) {
            pi.performGrassEraser();
            results.push(ids[i]);
          }
        }
      }
      return { erased: results.length, landIds: results };
    },
  };

  window.__qqframbot__ = Bridge;
  return 'bridge_v2_loaded';
})();
