var vaultinfo = {
    /*
     * addcloud.init()
     *
     * initialize the vault add cloud page
     */
    init: function() {
        // register back button event
        $("#vaultinfo-back-dashboard").click(function() {
            vaultinfo.backDashboard();
        });

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
                    'email':      item.email,
                    'space':      humanFileSize(item.quota, false),
                    'app-path':   window.app_path,
                };

                // append rendered template to tbody container
                tbody = tbody + Mustache.render(template, values);
            });

            $(".vaultinfo-list tbody").html(tbody);
        });
    },

    /*
     * addcloud.refresh()
     *
     * refresh new data
     */
    backDashboard: function() {
        window.location.href = window.app_path + "dashboard/";
    }
};


$(document).ready(function() {
    vaultinfo.init();
});
