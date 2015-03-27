(function(){
    var csrf = window.csrf = {};

    csrf.init = function() {
        $(document).on("ajaxSend", function(e, xhr, options) {
            if( $("meta[name=csrf-token]").length > 0 &&
                !/^(GET|HEAD|OPTIONS)$/i.test(options.type) ) {
                xhr.setRequestHeader("X-CSRF-Token", $("meta[name=csrf-token]").attr("content"));
            }
        });

        $(document).on("ajaxComplete", function(e, xhr, options) {
            var csrfRefresh = xhr.getResponseHeader("X-CSRF-Refresh");
            if( csrfRefresh != null ) {
                if( $("meta[name=csrf-token]").length > 0 ) {
                    // update csrf token
                    $("meta[name=csrf-token]").attr("content", csrfRefresh);

                } else {
                    // create new meta tag to store csrf token
                    var m = document.createElement("meta");
                    $(m).attr("name", "csrf-token")
                        .attr("content", csrfRefresh)
                        .appendTo($("head"));
                }

                // update hidden csrf token
                $("input[name=_csrf]").val(csrfRefresh);
            }
        });

        $(document).on("submit", "form", function(e) {
            var f = $(this);
            var token = $("meta[name=csrf-token]").attr("content");

            if( !/^(GET|HEAD|OPTIONS)$/i.test(f.method) ) {
                // edit submission url to include csrf token
                f.attr("action",
                    f.attr("action") +
                    ( ( !/\?/.test(f.attr("action")) ) ? "?" : "&" ) +
                    "_csrf=" +
                    token
                );
            }
        });
    }
})();

$(function() {
    csrf.init();
});