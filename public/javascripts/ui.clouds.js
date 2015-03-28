(function(){
    var clouds = window.clouds = {};

    var compiledTemplate = {};
    clouds.init = function() {
        // load lock statu records
        clouds.refreshLocks();
    }

    clouds.refreshLocks = function() {
        $.ajax({
            type: "GET",
            url: "/api/locks",
            dataType: "json",
        }).done(function(response) {
            // compile "lock-records-tpl" if needed
            if( typeof compiledTemplate.lockRecords == "undefined" ) {
                compiledTemplate.lockRecords = Handlebars.compile($("#lock-records-tpl").html());
            }

            // render lock list
            var rendered = compiledTemplate.lockRecords({locks: response});

            // show data in table
            $(".lock-status-records tbody").html(rendered);

            // bind unlock botton event
            $(".btn-lock-unlock").click(function() {
                clouds.unlock($(this).attr("data-lockid"));
            });

        }).error(function(error) {
            // compile "lock-record-empty-tpl" if needed
            if( typeof compiledTemplate.lockNoRecord == "undefined" ) {
                compiledTemplate.lockNoRecord = Handlebars.compile($("#lock-record-empty-tpl").html());
            }

            // show "no record" in table
            var rendered = compiledTemplate.lockNoRecord();
            $(".lock-status-records tbody").html(rendered);

            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#lock-message").html(rendered);
        });
    }

    clouds.unlock = function(lockid) {
        // double confirm user really want to unlock LevelDB access
        if( !confirm("Please confirm to UNLOCK LevelDB for other client?") ) {
            return;
        }

        // disable lock button
        $(".btn-lock-unlock").prop('disabled', true);

        // request delete account to server
        $.ajax({
            type: "POST",
            url: "/api/unlock/" + lockid
        }).done(function() {
            // compile "success-message-tpl" if needed
            if( typeof compiledTemplate.successMessage == "undefined" ) {
                compiledTemplate.successMessage = Handlebars.compile($("#success-message-tpl").html());
            }

            var rendered = compiledTemplate.successMessage({message: "Unlocked."});
            $("#lock-message").html(rendered);

        }).error(function(error) {
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#lock-message").html(rendered);

        }).complete(function() {
            clouds.refreshLocks();
        });
    }
})();

$(function() {
    clouds.init();
});
