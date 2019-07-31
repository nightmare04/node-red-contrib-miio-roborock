const EventEmitter = require('events');
const miio = require('miio');
const XiaomiRoborockVacuum = require('../static/js/homebridge-xiaomi-roborock-vacuum.js');


module.exports = function (RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.config = n;
            node.state = [];
            node.status = {};

            node.setMaxListeners(255);
            node.refreshFindTimer = null;
            node.refreshFindInterval = node.config.polling * 1000;
            node.on('close', () => this.onClose());

            node.connect().then(result => {
                node.getStatus(true).then(result => {
                    node.emit("onInitEnd", result);
                });
            });

            node.refreshStatusTimer = setInterval(function () {
                node.getStatus(true);
            }, node.refreshFindInterval);
        }

        // find(callback) {
        //     var node = this;
        //
        //     const devices = miio.devices({
        //         cacheTime: 300 // 5 minutes. Default is 1800 seconds (30 minutes)
        //     });
        //
        //     devices.on('available', device => {
        //         console.log('available');
        //         console.log(device);
        //         if(device.matches('placeholder')) {
        //             // This device is either missing a token or could not be connected to
        //         } else {
        //             // Do something useful with device
        //         }
        //     });
        //
        //
        // }

        onClose() {
            var that = this;
            clearInterval(that.refreshStatusTimer);

            if (node.device) node.device.destroy();
        }

        connect() {
            var node = this;

            return new Promise(function (resolve, reject) {
                node.miio = miio.device({
                    address: node.config.ip,
                    token: node.config.token
                }).then(device => {
                    node.device = device;
                    resolve(device);

                }).catch(err => {
                    node.warn('Miio Roborock Error: ' + err.message);
                    reject(err);
                });
            });
        }

        getStatus(force = false) {
            var that = this;

            return new Promise(function (resolve, reject) {
                if (force || !that.status) {
                    if (that.device) {
                        that.device.call("get_status", [])
                            .then(result => {
                                that.device.loadProperties(Object.keys(result[0])).then(result => {
                                    for (var key in result) {
                                        var value = result[key];
                                        if (key in that.status) {
                                            if (!(key in that.status) || that.status[key] !== value) {
                                                if ("error" === key) {
                                                    //get error message
                                                    if (value && "code" in value) {
                                                        if ("id" + value.code in XiaomiRoborockVacuum.errors) {
                                                            value.message = XiaomiRoborockVacuum.errors["id" + value.code].description;
                                                        }
                                                        that.warn('Miio Roborock error: #' + value.code + ': ' + value.message);
                                                    }

                                                    if (value) {
                                                        that.status[key] = value;
                                                        that.emit("onStateChangedError", value);
                                                    }
                                                } else {
                                                    that.status[key] = value;
                                                    that.emit("onStateChanged", {key: key, value: value}, true);
                                                }
                                            }
                                        } else { //init: silent add
                                            that.status[key] = value;
                                            that.emit("onStateChanged", {key: key, value: value}, false);
                                        }
                                    }

                                    resolve(that.status);
                                }).catch(err => {
                                    console.log('Encountered an error while controlling device');
                                    console.log('Error was:');
                                    console.log(err.message);
                                    reject(err);
                                });

                            })
                            .catch(err => {
                                console.log('Encountered an error while controlling device');
                                console.log('Error was:');
                                console.log(err.message);
                                reject(err);
                            });
                    } else {
                        reject('No device');
                    }
                } else {
                    resolve(that.status);
                }
            });
        }

    }

    RED.nodes.registerType('miio-roborock-server', ServerNode, {});
};
