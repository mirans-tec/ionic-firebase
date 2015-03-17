angular.module('mychat.controllers', [])

.controller('LoginCtrl', function ($scope, $ionicModal, $state, $firebaseAuth, $ionicLoading, $rootScope, $cordovaPush) {
    //console.log('Login Controller Initialized');

    var ref = new Firebase($scope.firebaseUrl);
    var auth = $firebaseAuth(ref);

    $ionicModal.fromTemplateUrl('templates/signup.html', {
        scope: $scope
    }).then(function (modal) {
        $scope.modal = modal;
    });

    $scope.createUser = function (user) {
        console.log("Create User Function called");
        if (user && user.email && user.password && user.displayname) {
            $ionicLoading.show({
                template: 'Signing Up...'
            });

            auth.$createUser({
                email: user.email,
                password: user.password
            }).then(function (userData) {
                alert("User created successfully!");
                ref.child("users").child(userData.uid).set({
                    email: user.email,
                    displayName: user.displayname
                });
                $ionicLoading.hide();
                $scope.modal.hide();
            }).catch(function (error) {
                alert("Error: " + error);
                $ionicLoading.hide();
            });
        } else
            alert("Please fill all details");
    }

    $scope.signIn = function (user) {

        if (user && user.email && user.pwdForLogin) {
            $ionicLoading.show({
                template: 'Signing In...'
            });
            auth.$authWithPassword({
                email: user.email,
                password: user.pwdForLogin
            }).then(function (authData) {
                console.log("Logged in as:" + authData.uid);
                ref.child("users").child(authData.uid).once('value', function (snapshot) {
                    var val = snapshot.val();
                    // To Update AngularJS $scope either use $apply or $timeout
                    $scope.$apply(function () {
                        $rootScope.displayName = val;
                    });
                });
                $ionicLoading.hide();
                $state.go('tab.rooms');

                var tokenRef = ref.child("device_token");

                var iosConfig = {
                    "badge": true,
                    "sound": true,
                    "alert": true
                };
                $cordovaPush.register(iosConfig).then(function(result) {
                    // Success -- send deviceToken to server, and store for future use
                    console.log("result: " + result)
                    tokenRef.set({user: user.email, tokenID: result}).then(function (data) {
                        console.log("message added");
                    });

                }, function(err) {
                    alert("Registration error: " + err)
                });
                $rootScope.$on('$cordovaPush:notificationReceived', function(event, notification) {
                    console.log("notification");
                    console.log(event);
                    console.log(notification);
                    if (notification.alert) {
                        navigator.notification.alert(notification.alert);
                    }

                    if (notification.sound) {
                        var snd = new Media(event.sound);
                        snd.play();
                    }

                    if (notification.badge) {
                        $cordovaPush.setBadgeNumber(notification.badge).then(function(result) {
                            // Success!
                        }, function(err) {
                            // An error occurred. Show a message to the user
                        });
                    }
                });
            }).catch(function (error) {
                alert("Authentication failed:" + error.message);
                $ionicLoading.hide();
            });
        } else
            alert("Please enter email and password both");
    }
})

.controller('ChatCtrl', function ($scope, Chats, $state) {
    //console.log("Chat Controller initialized");

    $scope.IM = {
        textMessage: ""
    };

    Chats.selectRoom($state.params.roomId);

    var roomName = Chats.getSelectedRoomName();

    // Fetching Chat Records only if a Room is Selected
    if (roomName) {
        $scope.roomName = " - " + roomName;
        $scope.chats = Chats.all();
    }

    $scope.sendMessage = function (msg) {
        console.log(msg);
        Chats.send($scope.displayName, msg);
        $scope.IM.textMessage = "";
    }

    $scope.remove = function (chat) {
        Chats.remove(chat);
    }
})

.controller('WhiteboardCtrl', function ($scope, $state) {
    console.log("WhiteboardCtrl initialized");
    function touchHandler(event)
    {
        var touches = event.changedTouches,
            first = touches[0],
            type = "";
        switch(event.type)
        {
            case "touchstart": type = "mousedown"; break;
            case "touchmove":  type="mousemove"; break;
            case "touchend":   type="mouseup"; break;
            default: return;
        }
        //initMouseEvent(type, canBubble, cancelable, view, clickCount,
        //           screenX, screenY, clientX, clientY, ctrlKey,
        //           altKey, shiftKey, metaKey, button, relatedTarget);
        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
            first.screenX, first.screenY,
            first.clientX, first.clientY, false,
            false, false, false, 0/*left*/, null);
        first.target.dispatchEvent(simulatedEvent);
        //event.preventDefault();
    };
    document.addEventListener("touchstart", touchHandler, true);
    document.addEventListener("touchmove", touchHandler, true);
    document.addEventListener("touchend", touchHandler, true);
    document.addEventListener("touchcancel", touchHandler, true);
    var applicationId = 'dGGN78LVtNCgoQ';
    var boardId = "12345";//location.search.substring(1) || prompt("Enter a unique id for your board");
    var username = prompt("Enter a username (only letters and numbers please)");
    var width = 400;
    var height = 980;
    var rootRef = new Firebase('https://abdul7383.firebaseio.com/' + applicationId);
    var boardRef = rootRef.child(boardId);
    var layersRef = boardRef.child('layers');
    var usersRef = boardRef.child('users');
    var userRef = usersRef.child(username);
    var $body = $("#white_board");
    var $bottomCanvas = $('#bottom');
    var $topCanvas = $('#top');
    var bottomCanvas = $bottomCanvas.get(0);
    var topCanvas = $topCanvas.get(0);
    var bottomCtx = bottomCanvas.getContext('2d');
    var topCtx = topCanvas.getContext('2d');
    var newLayer;
    // View:
    var clear = function(ctx) {
        ctx.clearRect(0, 0, width, height);
    };
    var drawLayer = function(ctx, layer) {
        ctx.beginPath();
        ctx.lineWidth = layer.thickness;
        ctx.strokeStyle = layer.color;
        ctx.moveTo(layer.points[0].x, layer.points[0].y);
        _.each(_.rest(layer.points, 1), function(point) {
            ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
    };
    var showNewLayer = function() {
        clear(topCtx);
        drawLayer(topCtx, newLayer);
    };
    var drawChild = function(snapshot) {
        drawLayer(bottomCtx, snapshot.val());
    };
    var redraw = function() {
        clear(bottomCtx);
        layersRef.once('value', function(snapshot) {
            snapshot.forEach(drawChild);
        });
    };
    layersRef.on('child_added', drawChild);
    layersRef.on('child_removed', redraw);
    usersRef.on('child_changed', function(snapshot) {
        var name = snapshot.key();
        var user = snapshot.val();
        id = "cursor_"+name;
        var $cursor = $("#"+id);
        if(!$cursor.length) {
            $cursor = $('<div>').attr('id', id).addClass('cursor').text(name)
                .appendTo('body');
        }
        $cursor.css('left', user.cursorPoint.x).css('top', user.cursorPoint.y);
    });
    usersRef.on('child_removed', function(snapshot) {
        $("#cursor_"+snapshot.key()).remove();
    });
    // User input:
    userRef.onDisconnect().remove();;
    $topCanvas.on('mousedown', function(e) {
        newLayer = {
            points: [{x: e.pageX, y: e.pageY}],
            color: $("input[name=brush]:checked").attr('color'),
            thickness: $("input[name=brush]:checked").attr('thickness')
        };
        var now = function() { return new Date().getTime() };
        var last = 0;
        $body.on('mousemove.brush', function(e) {
            if(last < now() - 20) {
                newLayer.points.push({x: e.pageX, y: e.pageY});
                showNewLayer();
                last = now();
            }
        });
        $body.one('mouseup', function(e) {
            $body.off('mousemove.brush');
            layersRef.push(newLayer);
            clear(topCtx);
        });
    });
    $body.on(
        'mousemove',
        _.throttle(function(e) {
            userRef.child('cursorPoint').set({x: e.pageX, y: e.pageY});
        }, 30)
    );
    $("#clear").on('click', function() {
        layersRef.remove();
    });
    $("#undo").on('click', function() {
        var query = layersRef.limitToLast(1);
        query.once('child_added', function(snapshot) {
            layersRef.child(snapshot.key()).remove();
        });
    });
    $(document).keydown(function(e) {
        console.log(e.which)
        $("*[hotkey="+e.which+"]").click();
    });
    // prevent text cursor from showing up as you draw
    topCanvas.onselectstart = function () { return false; };

})

.controller('RoomsCtrl', function ($scope, Rooms, Chats, $state) {
    console.log("RoomsCtrl initialized");

        //console.log("Rooms Controller initialized");
    $scope.rooms = Rooms.all();

    $scope.openChatRoom = function (roomId) {
        $state.go('tab.chat', {
            roomId: roomId
        });
    }
});