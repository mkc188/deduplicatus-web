var auth = {
    username: '',
    ajax_token: '',

    /*
     * auth.init()
     *
     * initialize username and ajax token
     */
    init: function() {
        // register signout button event
        $("#signout-btn").click(function() {
            auth.signout();
        });

        $.ajax({
            type: "GET",
            url: window.app_path + "auth/token",
            dataType: "json",
        }).done(function(response) {
            if( response.success ) {
                auth.username = response.username;
                auth.ajax_token = response.ajax_token;
            }
        });
    },

    /*
     * auth.signout()
     *
     * signout the current session
     */
    signout: function() {
        $.ajax({
            type: "POST",
            url: window.app_path + "auth/signout",
            data: "token=" + auth.ajax_token,
            dataType: "json",
        }).done(function(response) {
            if( response.success ) {
                window.location.href = window.app_path;
            }
        });
    }
};

$(document).ready(function() {
    auth.init();
});
