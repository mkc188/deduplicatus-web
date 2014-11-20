var signin = {
    /*
     * signin.init()
     *
     * initialize the signin page
     */
    init: function() {
        // declare buttons in register form
        $("#register-btn").click(function() {
            signin.register();
        });
        $('#register-continue').click(function() {
            $("input#signin-username").prop('disabled', true).val($("input#register-username").val());
            $("input#signin-password").prop('disabled', true).val($("input#register-password").val());

            signin.proceed();
        });

        // declare buttons in signin form
        $("#signin-btn").click(function() {
            signin.proceed();
        });
        $("#signin-skip-btn").click(function() {
            signin.redirect();
        });
    },

    /*
     * signin.register()
     *
     * submit the register request to /auth/register
     */
    register: function() {
        // form check before submission
        var fields    = ["username", "password", "password2", "email"];
        var err_field = [];
        var username  = $("input#register-username").val();
        var password  = $("input#register-password").val();
        var password2 = $("input#register-password2").val();
        var email     = $("input#register-email").val();
        var error_msg = "";

        // remove all has-error class
        $('#register-failed').hide();
        $.each(fields, function(i, v) {
            $($("input#register-" + v).parent()[0]).removeClass("has-error");
        });

        // check password minimum length
        if( password.length < 8 ) {
            err_field.push("password");
            err_field.push("password2");
            error_msg = "Password should more than 8 characters long.";
        }

        // check password = password2
        if( !( password == password2 ) ) {
            err_field.push("password");
            err_field.push("password2");
            error_msg = "Password are not the same.";
        }

        // check email format
        if( !this.validateEmail(email) ) {
            err_field.push("email");
            error_msg = "Incorrect email format.";
        }

        // check empty field
        if( ( username.length == 0 ) ||
            ( password.length == 0 ) ||
            ( password2.length == 0 ) ||
            ( email.length == 0 ) ) {

            // mark to co-responding field to red
            if( username.length == 0 )  err_field.push("username");
            if( password.length == 0 )  err_field.push("password");
            if( password2.length == 0 ) err_field.push("password2");
            if( email.length == 0 )     err_field.push("email");
            error_msg = "All fields are required and cannot be empty.";
        }

        // mark all has-error class
        $.each(err_field, function(i, v) {
            $("input#register-" + v).parent().addClass("has-error");
        });

        if( err_field.length > 0 ) {
            $("#register-error-msg").text(error_msg);
            $('#register-failed').show();
            return;
        }

        // prepare submission JSON
        var aes_key  = CryptoJS.enc.Hex.parse(session_aes_key);
        var aes_iv   = CryptoJS.lib.WordArray.random(16);
        var submission = JSON.stringify({
            email: email,
            username: username,
            password: password,
        });
        var encrypted = CryptoJS.AES.encrypt(submission, aes_key, {iv: aes_iv});
        $.ajax({
            type: "POST",
            async: false,
            url: window.app_path + "auth/register",
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
                iv: encrypted.iv.toString(CryptoJS.enc.Base64)
            })
        }).done(function(response) {
            if( response.success ) {
                $('#register-failed').hide();
                $('#register-success').show();
                $('#form-register-inputs').hide();
                $('#register-btn').hide();
                $('#register-continue').show();
            } else {
                $("#register-error-msg").text(response.error_msg);
                $('#register-failed').show();
            }
        });
    },


    /*
     * signin.proceed()
     *
     * submit the encrypted password for user authentication
     */
    proceed: function() {
        // start encryption using AES-128-CBC
        var username = $("input#signin-username").val();
        var password = $("input#signin-password").val();
        var aes_key  = CryptoJS.enc.Hex.parse(session_aes_key);
        var aes_iv   = CryptoJS.lib.WordArray.random(16);
        var submission = JSON.stringify({
            username: username,
            password: password,
        });

        var encrypted = CryptoJS.AES.encrypt(submission, aes_key, {iv: aes_iv});
        $.ajax({
            type: "POST",
            async: false,
            url: window.app_path + "auth/signin",
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
                iv: encrypted.iv.toString(CryptoJS.enc.Base64)
            })
        }).done(function(response) {
            if( response.success ) {
                $("input#signin-username").parent().removeClass("has-error");
                $("input#signin-username").prop('disabled', true);
                $("input#signin-password").prop('disabled', true);
                $('#signin-failed').hide();

                // redirect user to console page
                signin.redirect();

            } else {
                $("input#signin-username").parent().addClass("has-error");
                $("#signin-error-msg").text(response.error_msg);
                $('#signin-failed').show();
            }
        });
    },

    /*
     * signin.redirect()
     *
     * redirect user to dashboard if the authentication succeeded
     */
    redirect: function() {
        window.location.href = 'vaults/';
    },

    /*
     * signin.validateEmail()
     *
     * check the email format
     */
    validateEmail: function(email) {
        var emailReg = new RegExp(/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i);
        if( emailReg.test(email) ) {
            return true;
        }

        return false;
    }
};

$(document).ready(function() {
    signin.init();
});
