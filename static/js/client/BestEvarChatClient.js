import $ from 'jquery';
import SockJS from 'sockjs-client';
import {RoomManager} from "../rooms";
import {UserManager} from "../users";
import {Logger, Settings, SoundManager} from "../util";
import {Alert, MainMenu, MessageLog} from "../components";
import {CLIENT_VERSION, MAX_RETRIES} from "../lib";

export class BestEvarChatClient {
    constructor(hostname = 'localhost:6969', routingPath = 'newchat') {
        this._hostname = hostname;
        this._routingPath = routingPath;

        Settings.init();
        new MainMenu(this);

        this._messageLog = new MessageLog();
        this._soundManager = new SoundManager();
        this._roomManager = new RoomManager(this, this._messageLog, this._soundManager);
        this._userManager = new UserManager(this, this._messageLog, this._soundManager);
        this._disconnectedAlert = null;
        this._reconnectAlert = null;
        this._reconnectTimeout = null;
        this._reconnectCount = 0;
        this._unreadMessageCount = 0;

        this.connect();
    }

    // Public functions

    connect() {
        this._sock = new SockJS(`http://${this._hostname}/${this._routingPath}/`);

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
        return Settings.tabTitle || `${name} | Best Evar Chat 3.0`;
    }

    setWindowTitle() {
        document.title = this._getTitle();
    }

    _incrementUnreadMessageCount() {
        if (!document.hasFocus()) {
            this._unreadMessageCount++;
            document.title = `(${this._unreadMessageCount}) ${this._getTitle()}`;
        }
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
    }

    sendChat(messageText) {
        const roomId = Settings.activeLogType === 'room' ? parseInt(Settings.activeLogId, 10) : Settings.activeLogId;
        this._send({
            'type': 'chat message',
            'message': messageText,
            'room id': roomId
        });
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

    createRoom(roomName) {
        this._send({
            'type': 'room action',
            'action': 'create',
            'owner id': Settings.userId,
            'room name': roomName
        });
    }

    deleteRoom(roomId) {
        this._send({
            'type': 'room action',
            'action': 'delete',
            'room id': roomId
        });
    }

    leaveRoom(roomId) {
        this._send({
            'type': 'room action',
            'action': 'leave',
            'room id': roomId
        });
    }

    sendInvitations(roomId, userIds) {
        this._send({
            'type': 'room action',
            'action': 'invite',
            'room id': roomId,
            'user ids': userIds
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

    updateUserSettings({username, color, faction}) {
        this._send({
            'type': 'settings',
            'data': {
                username,
                color,
                faction
            }
        });
    }

    updateClientSettings({volume, soundSet}) {
        this._send({
            'type': 'settings',
            'data': {
                volume,
                soundSet
            }
        });
    }

    updateAccountSettings({email, password1, password2}) {
        let password = {};
        if (password1 && password2) {
            password = {password: {password1, password2}};
        }
        this._send({
            'type': 'settings',
            'data': {
                email,
                ...password
            }
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
        }
        else if (message.includes('online')) {
            this._soundManager.playConnected();
        }
    }

    _attemptReconnect() {
        if (!this._disconnectedAlert) {
            this._disconnectedAlert = new Alert({content: 'Connection lost!!', type: 'permanent'});
        }

        const reconnect = () => {
            this._reconnectCount++;
            new Alert({content: `Attempting to reconnect to the server ... (${this._reconnectCount}/${MAX_RETRIES})`});
            this.connect();
        };
        window.clearTimeout(this._reconnectTimeout);

        if (this._reconnectCount < MAX_RETRIES) {
            this._reconnectTimeout = window.setTimeout(reconnect, 1000);
        }
        else if (!this._reconnectAlert) {
            this._reconnectAlert = new Alert({
                content: 'Failed to open connection to server.',
                type: 'actionable',
                actionText: 'Retry',
                actionCallback: () => {
                    this._reconnectCount = 0;
                    this._attemptReconnect();
                }
            });
        }
    }
}
