(function(){
    var auth = window.auth = {};

    auth.init = function() {
        // bind click event for signin button
        $("#signin-panel button").click(function() { auth.submit(); });
    }

    auth.submit = function() {
        $.ajax({
            type: "POST",
            url: "/api/signin",
            data: $("form#signin-panel").serialize(),
            beforeSend: function() {
                // disable all inputs and buttons
                $("#signin-panel button, #signin-panel input").prop('disabled', true);
            },
        }).done(function(response) {
            $("#signin-panel button").text("Success!")

            // redirect to management default page
            location.href = "/manage";

        }).error(function(xhr) {
            var passwordInput = $("#signin-panel input[name=password]");

            switch( xhr.status ) {
                case 401:
                    passwordInput.attr("data-content", "Your email or password is incorrect. Please re-try.")
                                 .attr("data-container", "body")
                                 .popover({placement: 'bottom'})
                                 .popover('show');
                    break;

                case 403:
                default:
                    passwordInput.attr("data-content", "Please refresh this page and re-try.")
                                 .attr("data-container", "body")
                                 .popover({placement: 'bottom'})
                                 .popover('show');
                    break;
            }

            // enable the form
            $("#signin-panel button, #signin-panel input").prop('disabled', false);
        });
    }
})();

$(function() {
    auth.init();
});
