import $ from 'jquery';
import SockJS from 'sockjs-client';
import {UserManager} from "../users";
import {Logger, NotificationManager, Settings, SoundManager} from "../util";
import {Alert, MessageLog} from "../components";
import {CLIENT_VERSION, MAX_RETRIES} from "../lib";


export class BestEvarChatClient {
    constructor(hostname = 'bestevarchat.com', routingPath = 'chat') {
        this._hostname = hostname;
        this._routingPath = routingPath;

        Settings.init();

        this._messageLog = new MessageLog();
        this._soundManager = new SoundManager();
        this._userManager = new UserManager(this, this._messageLog, this._soundManager);
        this._notificationManager = new NotificationManager((alertData) => new Alert(alertData));
        this._disconnectedAlert = null;
        this._reconnectAlert = null;
        this._reconnectTimeout = null;
        this._reconnectCount = 0;
        this._unreadMessageCount = 0;

        this.connect();
    }

    // Public functions

    connect() {
        this._sock = new SockJS(`https://${this._hostname}/${this._routingPath}/`);

        this._sock.onopen = () => {
            if (this._disconnectedAlert) {
                this._disconnectedAlert.remove();
                this._disconnectedAlert = null;
            }
            window.clearTimeout(this._reconnectTimeout);
            this._reconnectCount = 0;
            this._send({
                'type': 'version',
                'client version': CLIENT_VERSION
            });
        };
        this._sock.onmessage = (message) => this._handleMessage(message);
        this._sock.onclose = () => {
            console.log('Bye!');
            this._attemptReconnect();
        };

        Logger.set_socket(this._sock);
    }

    selectGeneralRoom() {
        this._roomManager.setActiveRoom(0);
    }

    _getTitle() {
        let name;
        if (Settings.activeLogType === 'thread') {
            name = this._userManager.getActiveThreadName();
        }
        else {
            name = this._roomManager.getActiveRoomName();
        }
        return Settings.tabTitle || `${name} | Best Evar Chat ${CLIENT_VERSION}`;
    }

    setWindowTitle() {
        document.title = this._getTitle();
    }

    _incrementUnreadMessageCount() {
        if (!document.hasFocus()) {
            this._unreadMessageCount++;
            document.title = `(${this._unreadMessageCount}) ${this._getTitle()}`;
            $("#favicon").attr("href", "/static/favicon2.png");
        }
    }

    sendMessageNotification(title, body, which_cat) {
        if (this._unreadMessageCount > 1) {
            body = `${this._unreadMessageCount} new messages`
        }
        this._notificationManager.sendMessageNotification(title, body, which_cat);
    }

    disableNotifications() {
        this._notificationManager.disableNotifications();
    }

    enableNotifications() {
        this._notificationManager.enableNotifications();
    }

    reprintLog() {
        if (Settings.activeLogType === 'room') {
            this._roomManager.setActiveRoom(Settings.activeLogId);
        }
        else {
            this._userManager.setActiveThread(Settings.activeLogId);
        }
    }

    resetUnreadMessageCount() {
        this._unreadMessageCount = 0;
        this.setWindowTitle();
        $("#favicon").attr("href", "/static/favicon.png");
    }

    sendChat(messageText) {
        if (Settings.activeLogType === 'room') {
            this._send({
                'type': 'chat message',
                'message': messageText,
                'room id': parseInt(Settings.activeLogId, 10)
            });
        }
        else {
            this._send({
                'type': 'private message',
                'message': messageText,
                'recipient id': Settings.activeLogId
            });
        }
    }

    updateUserList() {
        this._userManager.updateUserList();
    }

    sendIdle(shouldBeIdle) {
        const isIdle = this._userManager.getUserStatus(Settings.userId) === 'idle';
        if (isIdle === undefined) {
            return;
        }
        if ((shouldBeIdle && !isIdle) || (!shouldBeIdle && isIdle)) {
            this._send({
                'type': 'status',
                'status': shouldBeIdle ? 'idle' : 'active'
            });
        }
    }

    sendTyping() {
        const isTyping = this._userManager.getUserTypingStatus(Settings.userId);
        if (isTyping === undefined) {
            return;
        }
        const shouldBeTyping = $('.chat-bar').children('input').val().length > 0;
        if ((shouldBeTyping && !(isTyping && isTyping === Settings.activeLogId)) || (!shouldBeTyping && isTyping !== false)) {
            this._send({
                'type': 'typing',
                'status': shouldBeTyping ? Settings.activeLogId : false
            });
        }
    }

    sendImage(imageUrl, nsfw) {
        const roomId = Settings.activeLogType === 'room' ? parseInt(Settings.activeLogId, 10) : Settings.activeLogId;
        this._send({
            'type': 'image',
            'image url': imageUrl,
            'nsfw': nsfw,
            'room id': roomId
        });
    }

    sendImageUpload(imageData, imageType, nsfw) {
        const roomId = Settings.activeLogType === 'room' ? parseInt(Settings.activeLogId, 10) : Settings.activeLogId;
        this._send({
            'type': 'image upload',
            'image data': imageData,
            'image type': imageType,
            'nsfw': nsfw,
            'room id': roomId
        });
    }

    submitBug(bugData) {
        this._send({
            'type': 'bug',
            ...bugData
        });
    }

    submitFeature(featureData) {
        this._send({
            'type': 'feature',
            ...featureData
        });
    }

    joinRoom(roomId, accept = true, inviterId) {
        this._send({
            'type': 'room action',
            'action': 'join',
            'room id': roomId,
            accept,
            'inviter id': inviterId
        });
    }

    // Private functions

    _send(data) {
        if (this._sock && this._sock.readyState === 1) {  // SockJS.OPEN
            this._sock.send(JSON.stringify({
                'user id': Settings.userId,
                ...data
            }));
        }
    }

    _handleMessage({data: {data: messageData, type: messageType}}) {
        if (messageType === 'auth fail') {
            location.replace('/logout');
        }
        else if (messageType === 'room data') {
            this._receivedRoomData(messageData);
        }
        else if (messageType === 'private message data') {
            this._receivedPrivateMessageData(messageData);
        }
        else if (messageType === 'user list') {
            this._receivedUserList(messageData);
        }
        else if (messageType === 'update') {
            this._receivedUpdate(messageData);
        }
        else if (messageType === 'chat message') {
            this._receivedChatMessage(messageData);
        }
        else if (messageType === 'private message') {
            this._receivedPrivateMessage(messageData);
        }
        else if (messageType === 'alert') {
            this._receivedAlert(messageData);
        }
        else if (messageType === 'invitation') {
            this._receivedInvitation(messageData);
        }
    }

    _receivedRoomData({rooms, all}) {
        this._roomManager.addRooms(rooms, all);
    }

    _receivedPrivateMessageData({threads}) {
        this._userManager.addPrivateMessageThreads(threads);
    }

    _receivedUserList({users}) {
        this._userManager.updateUserList(users);
    }

    _receivedUpdate(messageData) {
        $.each(messageData, (key, value) => {
            Settings[key] = value;
            if (key === 'volume') {
                SoundManager.updateVolume();
            }
            if (key === 'soundSet') {
                this._soundManager.updateSoundSet();
            }
        });
    }

    _receivedChatMessage({'room id': roomId, ...messageData}) {
        this._roomManager.addMessage(messageData, roomId);
        this._incrementUnreadMessageCount();
    }

    _receivedPrivateMessage(messageData) {
        this._userManager.addMessage(messageData);
        this._incrementUnreadMessageCount();
    }

    _receivedInvitation({user, 'user id': userId, 'room id': roomId, 'room name': name}) {
        new Alert({
            content: `${user} is inviting you to join the room '${name}'.`,
            type: 'actionable',
            actionText: 'Join!',
            actionCallback: () => this.joinRoom(roomId, true, userId),
            dismissText: 'No, thanks.',
            dismissCallback: () => this.joinRoom(roomId, false, userId)
        });
        this._incrementUnreadMessageCount();
    }

    _receivedAlert({message, alert_type}) {
        new Alert({content: message, type: alert_type});
        if (message.includes('offline')) {
            this._soundManager.playDisconnected();
            this._notificationManager.sendStatusNotification(message, '', 'sleep');
        }
        else if (message.includes('online')) {
            this._soundManager.playConnected();
            this._notificationManager.sendStatusNotification(message, '', 'walk');
        }
    }

    _attemptReconnect() {
        const alertDelay = 3500;  // same as alert fade length

        // if not already present, show the disconnected alert
        if (!this._disconnectedAlert) {
            this._disconnectedAlert = new Alert({content: 'Connection lost!!', type: 'permanent'});
        }

        // remove any lingering reconnect alert
        if (this._reconnectAlert) {
            this._reconnectAlert.remove();
            this._reconnectAlert = null;
        }
        // clear existing timeout
        window.clearTimeout(this._reconnectTimeout);
        // define timeout callback
        const reconnect = () => {
            new Alert({content: `Attempting to reconnect to the server ... (${this._reconnectCount}/${MAX_RETRIES})`});
            this.connect();
        };

        // do the automatic reconnection attempts
        this._reconnectCount++;
        if (this._reconnectCount <= MAX_RETRIES) {
            this._reconnectTimeout = window.setTimeout(
                reconnect,
                // first attempt is immediate, all subsequent are delayed
                this._reconnectCount === 1 ? 0 : alertDelay
            );
        }
        else if (!this._reconnectAlert) {
            // automatic retries failed, show a new reconnect alert after delay
            this._reconnectTimeout = window.setTimeout(() => {
                this._reconnectAlert = new Alert({
                    content: 'Failed to open connection to server.',
                    type: 'dismiss',
                    dismissText: 'Retry',
                    dismissCallback: () => {
                        this._reconnectCount = 0;
                        this._attemptReconnect();
                    }
                });
            }, alertDelay);
        }
    }
}
