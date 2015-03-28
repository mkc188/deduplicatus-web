(function(){
    var home = window.home = {};

    var uri = new URI();
    var messageString = {
        "account_deleted": "Account Deleted.",
        "password_changed": "Password Changed. Please use the new password to sign in."
    };
    var compiledTemplate = {};
    home.init = function() {
        var showMessageDialog = false;

        if( uri.fragment() in messageString ) {
            // compile "success-message-tpl" if needed
            if( typeof compiledTemplate.successMessage == "undefined" ) {
                compiledTemplate.successMessage = Handlebars.compile($("#success-message-tpl").html());
            }

            var rendered = compiledTemplate.successMessage({message: messageString[uri.fragment()]});
            $(".jumbotron").prepend(rendered);
        }
    }
})();

$(function() {
    home.init();
});
