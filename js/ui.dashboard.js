var dashboard = {
    new_vault_id: '',

    /*
     * dashboard.init()
     *
     * initialize the dashboard page
     */
    init: function() {
        // register refresh button event
        $("#vault-list-refresh").click(function() {
            dashboard.refresh();
        });

        // register submit button of add device
        $("#new-vault-submit").click(function() {
            dashboard.newVault();
        });

        // register submit button of add device
        $("#new-vault-continue").click(function() {
            dashboard.newVaultContinue();
        });

        // reset and focus to first input when Add Device model shows
        $('#modal-new-vault').on('show.bs.modal', function (e) {
            $(".new-vault-inputs").val("");
            $("#new-vault-failed").hide();
            $("#new-vault-result").hide();
            $("#new-vault-submit").show();
            $("#new-vault-form").show();
        });
        $('#modal-new-vault').on('shown.bs.modal', function (e) {
            $("#new-vault-name").focus();
        });

        this.refresh();
    },

    /*
     * dashboard.refresh()
     *
     * refresh new data
     */
    refresh: function() {
        $.ajax({
            type: "GET",
            url: window.app_path + "vault/list",
            dataType: "json",
        }).done(function(response) {
            var template = $("#template-vault-list-row").html();
            var tbody = "";

            $.each(response, function(k, item) {
                if( item.totalSpace == 0 && item.usedSpace == 0 ) {
                    totalSpaceText = "-";
                    usedSpaceText = "-";
                } else {
                    totalSpaceText = humanFileSize(item.totalSpace, false);
                    usedSpaceText = humanFileSize(item.usedSpace, false);
                }

                // process cloud storage list
                if( item.finalized ) {
                    var vault_summary = "";
                    var vault_detail = "";
                    $.each(item.clouds, function(k, item) {
                        var cloud_val = {
                            'account-name':  item.email,
                            'provider-name': item.type,
                            'quota':         humanFileSize(item.quota, false),
                            'app-path':      window.app_path,
                        };

                        vault_summary = vault_summary + Mustache.render($("#template-vault-summary-item").html(), cloud_val);
                        vault_detail = vault_detail + Mustache.render($("#template-vault-detail-item").html(), cloud_val);
                    });
                } else {
                    var vault_summary = "Not finalized";
                    var vault_detail = "Not finalized";
                }

                // group all value into an object
                var values = {
                    'id':            item.id,
                    'name':          item.name,
                    'vault-summary': vault_summary,
                    'vault-detail':  vault_detail,
                    'used-space':    usedSpaceText,
                    'total-space':   totalSpaceText,
                    'app-path':      window.app_path,
                };
                values['is-' + item.mode] = true;

                // append rendered template to tbody container
                tbody = tbody + Mustache.render(template, values);
            });

            $(".vault-list tbody").html(tbody);

            // register button events
            $(".vault-clouds-icon").tooltip();
            $(".vault-clouds-expend").click(function() {
                dashboard.expendDetail($(this));
            });
            $(".vault-clouds-collapse").click(function() {
                dashboard.collapseDetail($(this));
            });
        });
    },

    /*
     * dashboard.newVault()
     *
     * submit request to create new vault
     */
    newVault: function() {
        var vault_name = $("input#new-vault-name").val();
        var vault_mode = $('input[name=new-vault-mode]:checked').val();

        $.ajax({
            type: "POST",
            url: window.app_path + "vault/new",
            dataType: "json",
            processData: false,
            data: JSON.stringify({
                ajax_token: auth.ajax_token,
                name: vault_name,
                mode: vault_mode
            })
        }).done(function(response) {
            if( response.success ) {
                // vault created, save id and show continue btn
                dashboard.new_vault_id = response.vault_id;
                $("#new-vault-failed").hide();
                $("#new-vault-result").show();
                $("#new-vault-submit").hide();
                $("#new-vault-form").hide();

            } else {
                // display error message
                $("#new-vault-error-msg")
                    .text(response.error_msg)
                    .parent()
                    .show();
            }
        });
    },

    /*
     * dashboard.newVaultContinue()
     *
     * redirect user to vault page for adding cloud storages
     */
    newVaultContinue: function() {
        window.location.href = window.app_path + "vault/" + this.new_vault_id;
    },

    /*
     * dashboard.expendDetail()
     *
     * show cloud storage details
     */
    expendDetail: function(elem) {
        elem.closest("td").find("span.vault-clouds-summary").hide();
        elem.closest("td").find("span.vault-clouds-detail").show();
    },

    /*
     * dashboard.collapseDetail()
     *
     * hide cloud storage details
     */
    collapseDetail: function(elem) {
        elem.closest("td").find("span.vault-clouds-summary").show();
        elem.closest("td").find("span.vault-clouds-detail").hide();
    }
};


$(document).ready(function() {
    dashboard.init();
});
