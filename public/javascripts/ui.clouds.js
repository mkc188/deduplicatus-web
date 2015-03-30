(function(){
    var clouds = window.clouds = {};

    var uri = new URI();
    var compiledTemplate = {};
    var messageString = {
        "add_success": { type: "success", message: "Cloud account added." },
        "add_error_rejected": { type: "error", message: "Request rejected." },
        "add_error_leveldb": { type: "error", message: "LevelDB error." },
        "add_error_database": { type: "error", message: "Database error." },
        "add_error_metafile_locked": { type: "error", message: "Metafile currently locked." },
        "add_error_metafile_finalized": { type: "error", message: "Metafile is finalized." },
        "add_error_duplicated": { type: "error", message: "Cloud account already added." }
    };
    clouds.init = function() {
        // load metafile and cloud accounts status
        clouds.loadStatus();

        // show success/error message redirected
        if( uri.fragment() in messageString ) {
            switch( messageString[uri.fragment()]["type"] ) {
                case "success":
                    // compile "success-message-tpl" if needed
                    if( typeof compiledTemplate.successMessage == "undefined" ) {
                        compiledTemplate.successMessage = Handlebars.compile($("#success-message-tpl").html());
                    }

                    var rendered = compiledTemplate.successMessage({message: messageString[uri.fragment()]["message"]});
                    break;

                case "error":
                    // compile "error-message-tpl" if needed
                    if( typeof compiledTemplate.errorMessage == "undefined" ) {
                        compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
                    }

                    var rendered = compiledTemplate.errorMessage({message: messageString[uri.fragment()]["message"]});
                    break;
            }
            $("#cloud-storage-message").html(rendered);
        }
    }

    clouds.loadStatus = function() {
        $.ajax({
            type: "GET",
            url: "/api/clouds",
            dataType: "json",
        }).done(function(response) {
            var storageMode = "";
            var storageModeNote = "";
            var showActions = false;

            // determine storage mode and status
            switch( response.storageMode ) {
                case "deduplication":
                    storageMode = "Deduplication-enabled";
                    if( response.finalized ) {
                        storageModeNote = "account finalized";
                    } else {
                        showActions = !response.locked;
                    }
                    $("div.message-deduplication").removeClass("hidden");

                    // load lock statu records
                    clouds.refreshLocks();
                    $("div.locks-section").removeClass("hidden");
                    break;

                case "file-manager":
                    storageMode = "File Manager";
                    showActions = !response.locked;
                    $("div.message-file-manager").removeClass("hidden");
                    break;
            }
            $("h2#storage-mode span").text(storageMode);
            $("h2#storage-mode small").text(storageModeNote);

            if( Object.keys(response.clouds).length > 0 ) {
                // compile "cloud-storage-accounts-tpl" if needed
                if( typeof compiledTemplate.cloudRecords == "undefined" ) {
                    compiledTemplate.cloudRecords = Handlebars.compile($("#cloud-storage-accounts-tpl").html());
                }

                // show "no record" in table
                var rendered = compiledTemplate.cloudRecords({accounts: response.clouds, actions: showActions});
                $(".cloud-storage-accounts tbody").html(rendered);

            } else {
                $("div.message-add-cloud").removeClass("hidden");

                // compile "cloud-storage-accounts-empty-tpl" if needed
                if( typeof compiledTemplate.cloudNoRecord == "undefined" ) {
                    compiledTemplate.cloudNoRecord = Handlebars.compile($("#cloud-storage-accounts-empty-tpl").html());
                }

                // show "no record" in table
                var rendered = compiledTemplate.cloudNoRecord();
                $(".cloud-storage-accounts tbody").html(rendered);
            }

            if( showActions ) {
                // compile "cloud-storage-accounts-add-tpl" if needed
                if( typeof compiledTemplate.cloudAddAccount == "undefined" ) {
                    compiledTemplate.cloudAddAccount = Handlebars.compile($("#cloud-storage-accounts-add-tpl").html());
                }

                // show "add clouds" in table
                var rendered = compiledTemplate.cloudAddAccount({ "finalize-btn": (response.storageMode == "deduplication")});
                $(".cloud-storage-accounts tfoot").html(rendered);

                // bind add cloud botton event
                $(".btn-add-cloud").click(function() {
                    clouds.add($(this).attr("data-path"));
                });

                // bind remove cloud botton event
                $(".btn-remove-cloud").click(function() {
                    clouds.remove($(this).parents("tr").attr("data-cloudid"));
                });

                // bind add cloud botton event
                $(".btn-finalize").click(function() {
                    clouds.finalize();
                });
            }

        }).error(function(error) {
            // show "-" in storage mode
            $("h2#storage-mode span").text("-");

            // compile "lock-record-empty-tpl" if needed
            if( typeof compiledTemplate.cloudNoRecord == "undefined" ) {
                compiledTemplate.cloudNoRecord = Handlebars.compile($("#cloud-storage-accounts-empty-tpl").html());
            }

            // show "no record" in table
            var rendered = compiledTemplate.cloudNoRecord();
            $(".cloud-storage-accounts tbody").html(rendered);

            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#cloud-storage-message").html(rendered);
        });
    }

    clouds.add = function(path) {
        $(".btn-cloud-actions").prop('disabled', true);

        $.ajax({
            type: "GET",
            url: path,
            dataType: "json",
        }).done(function(response) {
            location.href = response.redirect;

        }).error(function(error) {
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#cloud-storage-message").html(rendered);

            $(".btn-cloud-actions").prop('disabled', false);
        });
    }

    clouds.remove = function(cloudid) {
        $(".btn-cloud-actions").prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "/api/metafile/" + cloudid + "/remove",
        }).done(function(response) {
            // page refresh
            location.href = "/manage/clouds/reload";

        }).error(function(error) {
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#cloud-storage-message").html(rendered);

            $(".btn-cloud-actions").prop('disabled', false);
        });
    }

    clouds.finalize = function() {
       $(".btn-cloud-actions").prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "/api/metafile/finalize",
        }).done(function(response) {
            // page refresh
            location.href = "/manage/clouds/reload";

        }).error(function(error) {
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            // show error message
            var rendered = compiledTemplate.errorMessage({message: error.responseText});
            $("#cloud-storage-message").html(rendered);

            $(".btn-cloud-actions").prop('disabled', false);
        });
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
