import $ from 'jquery';
import {LoggingClass, Settings} from "../util";
import {Modal} from "./Modal";
import {BestColorPicker} from "./BestColorPicker";
import {Alert} from "./Alert";

export class MainMenu extends LoggingClass {
    constructor(chatClient) {
        super('MainMenu');
        this._chatClient = chatClient;
        this._menuContents = $('#main_menu').next('.popout-menu');

        this._menuContents
            .append(this._new_menu_item(
                'Client Settings',
                ['fas', 'desktop'],
                () => new Modal({
                    form: true,
                    title: 'Client Settings',
                    content: () => {
                        let muted = Settings.muted;
                        let volume = Settings.volume;

                        const getButtonContents = () => {
                            let iconStackWrapper = $('<span>').addClass('fa-stack fa');
                            if (muted) {
                                return iconStackWrapper.append($('<i>').addClass('fas fa-volume-off fa-stack-2x')).append($('<i>').addClass('fas fa-ban fa-stack-2x text-danger'));
                            }
                            else if (volume > 50) {
                                return iconStackWrapper.append($('<i>').addClass('fas fa-volume-up fa-stack-2x'));
                            }
                            else {
                                return iconStackWrapper.append($('<i>').addClass('fas fa-volume-down fa-stack-2x'));
                            }
                        };

                        return $('<div>')
                            .append($('<div>').addClass('form-group')
                                // Browser tab title
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Tab Title', for: 'tab_title'}))
                                        .append($('<input>', {id: 'tab_title', placeholder: '<Room> | Best Evar Chat 3.0'})
                                            .val(Settings.tabTitle)))
                                    // Volume
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Volume', for: 'volume'}))
                                        .append($('<input>', {
                                            id: 'volume',
                                            type: 'range',
                                            value: volume
                                        }).change(event => {
                                            volume = event.target.value;
                                            muted = parseInt(volume, 10) === 0;
                                            console.log(volume, muted);
                                            $('#muted').val(muted);
                                            $('#volume_button').html(getButtonContents());
                                        }))
                                        .append($('<div>', {id: 'volume_button'})
                                            .click(() => {
                                                muted = !muted;
                                                $('#volume_button').html(getButtonContents());
                                                $('#muted').val(muted);
                                            })
                                            .append(getButtonContents())))
                                    .append($('<input>', {type: 'hidden', id: 'muted', value: muted}))
                                    // Sound set
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Sound Set', for: 'sound_set'}))
                                        .append($('<select>', {id: 'sound_set'})
                                            .append($.map(['AIM', 'MSN'], item => {
                                                return $('<option>', {value: item, text: item});
                                            })).val(Settings.soundSet)))
                                    // Client font size
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Font Size', for: 'font_size'}))
                                        .append($('<select>', {id: 'font_size'})
                                            .append($.map([12, 14, 16, 18, 20, 22, 24], item => {
                                                return $('<option>', {value: item, text: item});
                                            })).val(Settings.fontSize)))
                                    // Hide images by default
                                    .append($('<div>').addClass('form-element check-box')
                                        .append($('<label>', {text: 'Hide images by default', for: 'hide_images'}))
                                        .append($('<input>', {
                                            type: 'checkbox',
                                            id: 'hide_images'
                                        }).prop('checked', Settings.hideImages))
                                        .append($('<label>', {for: 'hide_images'}).addClass('check-box')))
                                    // Timestamp mode
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Timestamps', for: 'timestamps'}))
                                        .append($('<select>', {id: 'timestamps'})
                                            .append($('<option>', {value: 'date_time', text: 'Date & Time'}))
                                            .append($('<option>', {value: 'just_time', text: 'Just Time'}))
                                            .append($('<option>', {value: 'off', text: 'Off'}))
                                            .val(Settings.timestamps)
                                        ))
                            );
                    },
                    buttonText: 'Save',
                    buttonClickHandler: () => {
                        Settings.tabTitle = $('#tab_title').val();
                        this._chatClient.setWindowTitle();

                        Settings.fontSize = $('#font_size').val();
                        $('body')[0].style.fontSize = `${Settings.fontSize}px`;

                        Settings.hideImages = $('#hide_images').prop('checked');
                        Settings.timestamps = $('#timestamps').val();
                        Settings.muted = $('#muted').val();

                        let serverChanges = {};
                        const newVolume = $('#volume').val();
                        if (newVolume !== Settings.volume) {
                            serverChanges['volume'] = newVolume;
                        }
                        const newSoundSet = $('#sound_set').val();
                        if (newSoundSet !== Settings.soundSet) {
                            serverChanges['soundSet'] = newSoundSet;
                        }

                        if (Object.keys(serverChanges).length === 0) {
                            new Alert({content: 'No changes made.'});
                            this.debug('No changes made to client settings.');
                        }
                        else {
                            this._chatClient.updateClientSettings(serverChanges);
                            this.debug('Client settings saved!');
                        }
                    }
                })
            ))
            .append(this._new_menu_item(
                'User Settings',
                ['far', 'user-circle'],
                () => {
                    const colorPicker = new BestColorPicker($('<div>', {id: 'color'}));
                    return new Modal({
                        form: true,
                        title: 'User Settings',
                        content: $('<div>')
                            .append($('<div>').addClass('form-group')
                                // Display name
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Display Name', for: 'username'}))
                                        .append($('<input>', {id: 'username'}).val(Settings.username)))
                                    // Color
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Color', for: 'color'}))
                                        .append(colorPicker.element))
                                    // Faction
                                    .append($('<div>').addClass('form-element')
                                        .append($('<label>', {text: 'Faction', for: 'faction'}))
                                        .append($('<i>').addClass(`fab fa-fw ${Settings.faction}`))
                                        .append($('<select>', {id: 'faction'})
                                            .append(Object.entries(Settings.allowedFactions).map(([displayName, value]) => $('<option>', {
                                                text: displayName,
                                                value: value
                                            })))
                                            .val(Settings.faction)))
                            ),
                        buttonText: 'Save',
                        buttonClickHandler: () => {
                            let serverChanges = {};

                            const newUsername = $('#username').val();
                            if (newUsername !== Settings.username) {
                                serverChanges['username'] = newUsername;
                            }
                            const newColor = colorPicker.color;
                            if (newColor !== Settings.color) {
                                serverChanges['color'] = newColor;
                            }
                            const newFaction = $('#faction').val();
                            if (newFaction !== Settings.faction) {
                                serverChanges['faction'] = newFaction;
                            }

                            if (Object.keys(serverChanges).length === 0) {
                                new Alert({content: 'No changes made.'});
                                this.debug('No changes made to user settings.');
                            }
                            else {
                                this._chatClient.updateUserSettings(serverChanges);
                                this.debug('User settings saved!');
                            }
                        }
                    });
                }
            ))
            .append(this._new_menu_item(
                'Account Settings',
                ['fas', 'cogs'],
                () => new Modal({
                    form: true,
                    title: 'Account Settings',
                    content: $('<div>')
                        .append($('<div>').addClass('form-group')
                            // Email
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Email Address', for: 'email'}))
                                    .append($('<input>', {
                                        id: 'email',
                                        type: 'email',
                                        autocomplete: 'email'
                                    }).val(Settings.email)))
                                // Password
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Change Password', for: 'password1'}))
                                    .append($('<input>', {
                                        id: 'password1',
                                        type: 'password',
                                        placeholder: 'New password',
                                        autocomplete: "new-password"
                                    })))
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: '', for: 'password2'}))
                                    .append($('<input>', {
                                        id: 'password2',
                                        type: 'password',
                                        placeholder: 'Confirm password',
                                        autocomplete: "new-password"
                                    })))
                        ),
                    buttonText: 'Save',
                    buttonClickHandler: () => {
                        this._chatClient.updateAccountSettings({
                            email: $('#email').val(),
                            password1: $('#password1').val(),
                            password2: $('#password2').val()
                        });
                        this.debug('Account settings saved!');
                    }
                })
            ))
            .append(this._new_menu_item(
                'Bug Report',
                ['fas', 'bug'],
                () => {
                    new Modal({
                        form: true,
                        title: 'Report a Bug',
                        content: $('<div>')
                            .append('You found a bug? Nice job!')
                            .append($('<div>').addClass('form-group')
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Title', for: 'title'}))
                                    .append($('<input>', {
                                        id: 'title',
                                        type: 'text',
                                        value: ''
                                    })))
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Body', for: 'body'}))
                                    .append($('<textarea>', {
                                        id: 'body',
                                        value: ''
                                    })))),
                        buttonText: 'Send it in!',
                        cancelText: 'Nevermind',
                        buttonClickHandler: () => {
                            const title = $('#title').val();
                            if (title) {
                                this._chatClient.submitBug({
                                    title: `[Best Evar Chat] ${title} (submitted by ${Settings.userId})`,
                                    body: $('#body').val()
                                });
                            }
                        }
                    });
                }
            ))
            .append(this._new_menu_item(
                'Feature Request',
                ['fas', 'heart'],
                () => {
                    new Modal({
                        form: true,
                        title: 'Request a Feature',
                        content: $('<div>')
                            .append('So, this chat isn\'t good enough for you? Fine! What do you want?')
                            .append($('<div>').addClass('form-group')
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Title', for: 'title'}))
                                    .append($('<input>', {
                                        id: 'title',
                                        type: 'text',
                                        value: ''
                                    })))
                                .append($('<div>').addClass('form-element')
                                    .append($('<label>', {text: 'Body', for: 'body'}))
                                    .append($('<textarea>', {
                                        id: 'body',
                                        value: ''
                                    })))),
                        buttonText: 'Awesome!',
                        cancelText: 'Just kidding',
                        buttonClickHandler: () => {
                            const title = $('#title').val();
                            if (title) {
                                this._chatClient.submitFeature({
                                    title: `[Best Evar Chat] ${title} (submitted by ${Settings.userId})`,
                                    body: $('#body').val()
                                });
                            }
                        }
                    });
                }
            ))
            .append(this._new_menu_item(
                'About',
                ['fas', 'question'],
                () => {
                    new Modal({
                        showCancel: false,
                        title: 'About',
                        content: $('<div>').text('Figure out a way to get this dynamically populated.'),
                        buttonText: 'Unbelievable!',
                        buttonClickHandler: () => false
                    });
                }
            ))
            .append(Settings.userId === 'audrey' ? this._new_menu_item(
                'Admin Tools',
                ['fas', 'feather-alt'],
                () => {
                    new Modal({
                        showCancel: false,
                        title: 'Super Secret Stuff',
                        content: $('<div>').text('yeah you know this is where the cool kids go'),
                        buttonText: '1337',
                        buttonClickHandler: () => false
                    });
                }
            ) : null)
            .append(this._new_menu_item(
                'Log Out',
                ['fas', 'sign-out-alt'],
                () => window.location = '/logout'
            ));

    }

    _new_menu_item(title, icon, clickHandler) {
        return $('<span>').addClass('menu-item')
            .append($('<span>').addClass(`${icon[0]} fa-fw fa-${icon[1]}`))
            .append(title)
            .click(event => {
                event.stopPropagation();
                $('.overlay').hide();
                this._menuContents.hide();
                clickHandler();
            });
    }
}
