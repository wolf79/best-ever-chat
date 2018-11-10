import twemoji from "twemoji";
import {Settings} from "./util";

export const CLIENT_VERSION = '3.0';
export const MAX_RETRIES = 3;

export function _parseEmojis(element) {
    twemoji.parse(element || document.body, {
        base: '/static/',
        folder: 'emojione/assets',
        attributes: function (icon, variant) {
            return {title: icon + variant};
        }
    });
}

export function setTitle(roomName) {
    window.document.title = Settings.tabTitle || `${roomName} | Best Evar Chat 3.0`;
}
