/**
 * QQFramBot Game Bridge
 *
 * 注入到 QQ 农场游戏页面（out_page-frame.html 的 executeJavaScript context）。
 * 通过 Cocos Creator API 操控游戏。
 */
(function () {
  'use strict';
  if (window.__qqframbot_bridge__) return 'bridge_already_loaded';
  window.__qqframbot_bridge__ = true;

  var Bridge = {
    getSceneInfo: function () {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      var scene = cc.director.getScene();
      if (!scene) return { error: 'no scene' };
      return {
        name: scene.name,
        childCount: scene.children.length,
        children: scene.children.map(function (c) {
          return {
            name: c.name,
            active: c.active,
            childCount: c.children ? c.children.length : 0,
          };
        }),
      };
    },

    walkNodes: function (path, maxDepth) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      maxDepth = maxDepth || 3;
      var scene = cc.director.getScene();
      var root = path ? cc.find(path, scene) : scene;
      if (!root) return { error: 'node not found: ' + path };

      function walk(node, depth) {
        var info = {
          name: node.name,
          active: node.active,
          pos: node.position
            ? [Math.round(node.position.x), Math.round(node.position.y)]
            : null,
          comps: [],
        };
        if (node._components) {
          info.comps = node._components.map(function (c) {
            return c.__classname__ || c.constructor.name;
          });
        }
        if (depth < maxDepth && node.children) {
          info.ch = node.children.map(function (c) {
            return walk(c, depth + 1);
          });
        }
        return info;
      }
      return walk(root, 0);
    },

    findByComponent: function (componentName) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      var scene = cc.director.getScene();
      var results = [];

      function getPath(node) {
        var parts = [];
        var n = node;
        while (n && n !== scene) {
          parts.unshift(n.name);
          n = n.parent;
        }
        return parts.join('/');
      }

      function search(node) {
        if (node._components) {
          for (var i = 0; i < node._components.length; i++) {
            var comp = node._components[i];
            var name = comp.__classname__ || comp.constructor.name;
            if (name.indexOf(componentName) >= 0) {
              results.push({
                path: getPath(node),
                component: name,
                active: node.active,
              });
            }
          }
        }
        if (node.children) {
          for (var j = 0; j < node.children.length; j++) {
            search(node.children[j]);
          }
        }
      }
      search(scene);
      return results;
    },

    simulateTouch: function (path) {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      var scene = cc.director.getScene();
      var node = cc.find(path, scene);
      if (!node) return { error: 'node not found: ' + path };

      var touch = new cc.Touch(0, 0);
      var event = new cc.Event.EventTouch([touch], false, cc.Node.EventType.TOUCH_END);
      node.dispatchEvent(event);
      return { ok: true, path: path };
    },

    getGameState: function () {
      if (typeof cc === 'undefined') return { error: 'cc not found' };
      var scene = cc.director.getScene();
      if (!scene) return { error: 'no scene' };

      var state = {
        scene: scene.name,
        timestamp: Date.now(),
      };

      // 搜索农场相关组件
      var farmNodes = [];
      function searchFarm(node) {
        if (node._components) {
          for (var i = 0; i < node._components.length; i++) {
            var comp = node._components[i];
            var name = comp.__classname__ || comp.constructor.name;
            if (
              name.indexOf('Farm') >= 0 ||
              name.indexOf('Crop') >= 0 ||
              name.indexOf('Land') >= 0 ||
              name.indexOf('Plant') >= 0 ||
              name.indexOf('field') >= 0
            ) {
              farmNodes.push({
                path: getPath(node),
                comp: name,
                data: tryExtractData(comp),
              });
            }
          }
        }
        if (node.children) {
          for (var j = 0; j < node.children.length; j++) {
            searchFarm(node.children[j]);
          }
        }
      }

      function getPath(node) {
        var parts = [];
        var n = node;
        while (n && n !== scene) {
          parts.unshift(n.name);
          n = n.parent;
        }
        return parts.join('/');
      }

      function tryExtractData(comp) {
        var data = {};
        try {
          var keys = Object.keys(comp);
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k.startsWith('_') || k === 'node' || k === '__eventTargets') continue;
            var v = comp[k];
            var t = typeof v;
            if (t === 'string' || t === 'number' || t === 'boolean') {
              data[k] = v;
            }
          }
        } catch (e) {}
        return data;
      }

      searchFarm(scene);
      state.farmNodes = farmNodes;
      return state;
    },
  };

  window.__qqframbot__ = Bridge;
  return 'bridge_loaded';
})();
