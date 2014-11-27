var addcloud = {
    /*
     * addcloud.init()
     *
     * initialize the vault add cloud page
     */
    init: function() {
        // register cloud provider buttons event
        $(".addcloud-selections button").click(function() {
            addcloud.cloudOAuth($(this).attr("data-cloud"));
        });

        // register finalize button event
        $("#addcloud-finalize-submit").click(function() {
            addcloud.finalize();
        });

        if( window.previous_err.length > 1 ) {
            $('#addcloud-error-msg').text(window.previous_err);
            $('#addcloud-failed').show();
        }

        this.refresh();
    },

    /*
     * addcloud.refresh()
     *
     * refresh new data
     */
    refresh: function() {
        $.ajax({
            type: "GET",
            url: window.app_path + "vault/listCloud/" + window.vault_id,
            dataType: "json",
        }).done(function(response) {
            var template = $("#template-cloud-list-row").html();
            var tbody = "";

            $.each(response, function(k, item) {
                var values = {
                    'identifier': item.identifier,
                    'provider':   item.type,
                    'name':       item.name,
                    'space':      humanFileSize(item.quota, false),
                    'app-path':   window.app_path,
                };

                // append rendered template to tbody container
                tbody = tbody + Mustache.render(template, values);
            });

            if( tbody.length > 0 ) {
                $(".addcloud-list tbody").html(tbody);

                // register button events
                $(".addcloud-delete-item").click(function() {
                    addcloud.removeItem($(this).closest("tr").attr("data-identifier"));
                });
            } else {
                $(".addcloud-list tbody").html($("#template-cloud-list-empty").html());
            }
        });
    },

    /*
     * addcloud.removeItem()
     *
     * remove one entry from the cloud list
     */
    removeItem: function(identifier) {
        $.ajax({
            type: "POST",
            url: window.app_path + "vault/removeCloud/" + window.vault_id,
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ajax_token: auth.ajax_token,
                identifier: identifier,
            })
        }).done(function(response) {
            addcloud.refresh();
        });
    },

    /*
     * addcloud.cloudOAuth()
     *
     * obtain OAuth redirection for adding cloud account
     */
    cloudOAuth: function(cloud) {
        $('#addcloud-failed').hide();
        $.ajax({
            type: "POST",
            url: window.app_path + "vault/pre-oauth/" + window.vault_id,
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ajax_token: auth.ajax_token,
                cloud: cloud,
            })
        }).done(function(response) {
            if( response.success ) {
                window.location.href = response.oauth;
            } else {
                $('#addcloud-error-msg').text(response.error_msg);
                $('#addcloud-failed').show();
            }
        });
    },

    /*
     * addcloud.finalize()
     *
     * mark the vault as finalized and redirect user to file browser
     */
    finalize: function() {
        $.ajax({
            type: "POST",
            url: window.app_path + "vault/finalize/" + window.vault_id,
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ajax_token: auth.ajax_token,
            })
        }).done(function(response) {
            window.location.href = window.app_path + "vault/" + window.vault_id;
        });
    }
};


$(document).ready(function() {
    addcloud.init();
});
