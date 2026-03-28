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

    /*
     * 一键操作 — 通过 icon sprite name 查找按钮索引，不依赖固定顺序
     */

    /** 根据 icon sprite name 找到按钮索引 */
    _findButtonIndex: function (iconName) {
      var ock = getOneClick();
      var parent = ock.parentNode;
      if (!parent || !parent.children) return -1;
      for (var i = 0; i < parent.children.length; i++) {
        var child = parent.children[i];
        for (var j = 0; j < child.children.length; j++) {
          var sp = child.children[j].getComponent('cc.Sprite');
          if (sp && sp.spriteFrame && sp.spriteFrame.name === iconName) return i;
        }
      }
      return -1;
    },

    /** 一键收获（自己农场）/ 一键偷菜（好友农场） */
    harvestAll: function () {
      var ock = getOneClick();
      var ids = ock.getAllHarvestableLandIds();
      if (ids.length === 0) return { count: 0 };
      var idx = this._findButtonIndex('icon_steals');
      if (idx < 0) idx = this._findButtonIndex('icon_harvests');
      if (idx < 0) return { error: 'harvest button not found' };
      ock.onButtonClick(idx);
      return { count: ids.length, landIds: ids };
    },

    /** 一键浇水 */
    waterAll: function () {
      var ock = getOneClick();
      var ids = ock.getAllWaterableLandIds();
      if (ids.length === 0) return { count: 0 };
      var idx = this._findButtonIndex('icon_waterings');
      if (idx < 0) return { error: 'water button not found' };
      ock.onButtonClick(idx);
      return { count: ids.length, landIds: ids };
    },

    /** 一键除草 */
    eraseGrassAll: function () {
      var ock = getOneClick();
      var ids = ock.getAllEraseGrassLandIds();
      if (ids.length === 0) return { count: 0 };
      var idx = this._findButtonIndex('icon_grass_erasers');
      if (idx < 0) return { error: 'eraseGrass button not found' };
      ock.onButtonClick(idx);
      return { count: ids.length, landIds: ids };
    },

    /** 一键杀虫 */
    killBugAll: function () {
      var ock = getOneClick();
      var ids = ock.getAllKillBugLandIds();
      if (ids.length === 0) return { count: 0 };
      var idx = this._findButtonIndex('icon_bug_killers');
      if (idx < 0) return { error: 'killBug button not found' };
      ock.onButtonClick(idx);
      return { count: ids.length, landIds: ids };
    },

    /* ── 好友系统 ── */

    /** 打开好友面板 */
    openFriendPanel: function () {
      var scene = getScene();
      var btn = cc.find('root/ui/LayerUI/main_ui_v2/Menu/Node_Friend/UIFriendEnterBtn', scene);
      btn.getComponent('UIFriendEnterBtn').onBtnFriend();
      return { ok: true };
    },

    /** 获取好友列表（需先 openFriendPanel，等 2 秒后调用） */
    getFriendList: function () {
      var scene = getScene();
      var subNode = cc.find('root/ui/LayerPopUp/FriendUI/root/mid/contentNode/SubFriendUI', scene);
      if (!subNode) return { error: 'friend panel not open' };
      var sv = subNode.getComponent('SubFriendUI').scrollViewEx;
      var list = sv.getDataList();
      return list.map(function (f) {
        return {
          gid: f.gid,
          name: f.name,
          remark: f.remark,
          level: f.level,
          steal: f.plant ? f.plant.steal_plant_num : 0,
          dry: f.plant ? f.plant.dry_num : 0,
          weed: f.plant ? f.plant.weed_num : 0,
          insect: f.plant ? f.plant.insect_num : 0,
        };
      });
    },

    /** 访问好友农场（需先 openFriendPanel） */
    visitFriend: function (gid) {
      var scene = getScene();
      var subNode = cc.find('root/ui/LayerPopUp/FriendUI/root/mid/contentNode/SubFriendUI', scene);
      if (!subNode) return { error: 'friend panel not open' };
      var sv = subNode.getComponent('SubFriendUI').scrollViewEx;
      var list = sv.getDataList();
      var target = list.find(function (f) { return f.gid === gid; });
      if (!target) return { error: 'friend not found: ' + gid };
      var items = sv.getAllItemIns();
      if (!items || items.length === 0) return { error: 'no rendered items' };
      var comp = items[0].getComponent('SubFriendItem');
      comp.data = target;
      comp.onVisitBtn();
      return { ok: true, name: target.name, gid: gid };
    },

    /** 回自己的农场 */
    backToOwnFarm: function () {
      var scene = getScene();
      var farm = cc.find('root/scene/farm_scene_v3', scene).getComponent('FarmMapComp');
      farm.getFarmEntity().MainUI.backOwerFarm();
      return { ok: true };
    },

    /** 当前是否在好友农场 */
    isVisiting: function () {
      var scene = getScene();
      var farm = cc.find('root/scene/farm_scene_v3', scene).getComponent('FarmMapComp');
      var model = farm.getFarmEntity().FarmModel;
      var vm = model.visitUserModel;
      var own = model.player_id;
      return {
        visiting: !!(vm && vm.gid && vm.gid !== own),
        ownId: own,
        visitGid: vm ? vm.gid : null,
        visitName: vm ? vm.name : null,
      };
    },
  };

  window.__qqframbot__ = Bridge;
  return 'bridge_v2_loaded';
})();
