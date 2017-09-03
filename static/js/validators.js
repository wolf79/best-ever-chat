$(document).ready(function () {
    $('#update-user').validate(userSettings);
    $('#update-account').validate(accountSettings);
});

var userSettings = {
    rules: {
        set_name: {
            required: true,
            remote: {
                url: '/validate_username',
                type: 'post',
                data: {
                    username: function () {
                        return Cookies.get('username');
                    },
                    _xsrf: function () {
                        return Cookies.get('_xsrf');
                    }
                }
            },
            minlength: 1,
            maxlength: 16
        },
        color: {
            required: true
        }
    },
    messages: {
        set_name: {
            remote: "Invalid name."
        }
    },
    submitHandler: function () {
        var username = Cookies.get("username");
        var data = {};
        var setName = $("#set_name");
        if (setName.val() !== '' && setName.val() !== username) {
            data.newUser = setName.val();
            data.oldUser = Cookies.get('username');
        }
        var color = Cookies.get("color");
        if (colorPicker.val() !== color) {
            data.newColor = $("#color").val();
        }
        var sounds = $('#volume-slider').val();
        if (sounds !== Cookies.get('sounds')) {
            data.newSounds = sounds;
        }
        var soundSet = $('input[name="sounds-radios"]:checked').val();
        if (soundSet !== Cookies.get('sound_set')) {
            data.newSoundSet = soundSet;
        }
        var faction = $('input[name="faction"]:checked').val();
        if (faction !== Cookies.get('faction')) {
            data.newFaction = faction;
        }

        if (data.newUser || data.newFaction || data.newColor || data.newSoundSet || data.newSounds) {
            if (!sock) connect();
            sock.send(JSON.stringify({
                'type': 'userSettings',
                'settings': data,
                'user': username
            }));
        }
        else {
            print_message({
                user: "Client",
                message: "No changes made",
                time: moment().unix()
            });
        }

        toggleModal('userSettings');
    }
};


var accountSettings = {
    rules: {
        new_password: {
            required: false,
            minlength: 3
        },
        new_password2: {
            equalTo: '#new_password'
        },
        email: {
            required: false
        }
    },
    submitHandler: function () {
        var username = Cookies.get("username");
        var data = {};

        var email = $('#email').val();
        if (email !== '' && email !== Cookies.get('email')) {
            data.newEmail = email;
        }

        var newPassword = $("#new_password");
        var newPassword2 = $("#new_password2");
        if (newPassword.val() !== '' && newPassword.val() === newPassword2.val()) {
            sock.send(JSON.stringify({
                'type': 'password_change',
                'data': [newPassword.val(), newPassword.val()],
                'user': username
            }));
            newPassword.val('');
            newPassword2.val('');
        }

        if (data.newEmail) {
            if (!sock) connect();
            sock.send(JSON.stringify({
                'type': 'userSettings',
                'settings': data,
                'user': username
            }));
        }
        else {
            print_message({
                user: "Client",
                message: "No changes made",
                time: moment().unix()
            });
        }

        toggleModal('accountSettings');
    }
};