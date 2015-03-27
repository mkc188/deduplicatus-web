(function(){
    var signup = window.signup = {};

    var compiledTemplate = {};
    signup.init = function() {
        // bind signup form submit botton event
        $("#signup-submit").click(function() { signup.submit(this); });
    }

    signup.submit = function(btn) {
        var form = $(btn).parents("form");
        if( !checkForm(form) ) {
            return;
        }

        // disable submit button
        $("#signup-submit").prop('disabled', true);

        $.ajax({
            type: "POST",
            url: "/api/signup",
            data: form.serialize(),
            dataType: "json",
        }).done(function(response) {
            // compile "success-message-tpl" if needed
            if( typeof compiledTemplate.successMessage == "undefined" ) {
                compiledTemplate.successMessage = Handlebars.compile($("#success-message-tpl").html());
            }

            var rendered = compiledTemplate.successMessage({message: "Success!"});
            $("#signup-error").html(rendered);

            // redirect to management page
            location.href = "/manage";

        }).error(function(error) {
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            if( Array.isArray(error.responseJSON) && error.responseJSON.length > 0 ) {
                // compile "warn-invalid-form-tpl" if needed
                if( typeof compiledTemplate.warnInvalidForm == "undefined" ) {
                    compiledTemplate.warnInvalidForm = Handlebars.compile($("#warn-invalid-form-tpl").html());
                }

                var message = compiledTemplate.warnInvalidForm({fields: error.responseJSON});

            } else {
                var message = "Unexpected Error";
            }

            var rendered = compiledTemplate.errorMessage({message: message});
            $("#signup-error").html(rendered);

            // enable submit button
            $("#signup-submit").prop('disabled', false);
        });
    }

    // private function: check form validity
    var checkForm = function(form) {
        $("#signup-error").text("");
        var invalidFields = [];
        var invalidRadio = [];

        $.each($(form).find("input, select, textarea"), function(k, v) {
            $(v).parent().removeClass("has-error");

            var valid = false;

            if( v.type == "textarea" ) {
                var re = new RegExp($(v).attr("pattern").replace('-', '\\-'));
                valid = re.test($(v).val());
            } else {
                valid = v.checkValidity();
            }

            if( !valid ) {
                if( v.type == "radio" ) {
                    if( invalidRadio.indexOf($(v).attr("name")) == -1 ) {
                        invalidFields.push($(v).attr("data-title"));
                        invalidRadio.push($(v).attr("name"));
                    }
                } else {
                    invalidFields.push($("label[for=" + $(v).attr("id") + "]").text());
                }

                $(v).parent().addClass("has-error");
            }
        });

        // show error if there is any invalid fields
        if( invalidFields.length > 0 ) {
            // compile "warn-invalid-form-tpl" if needed
            if( typeof compiledTemplate.warnInvalidForm == "undefined" ) {
                compiledTemplate.warnInvalidForm = Handlebars.compile($("#warn-invalid-form-tpl").html());
            }
            // compile "error-message-tpl" if needed
            if( typeof compiledTemplate.errorMessage == "undefined" ) {
                compiledTemplate.errorMessage = Handlebars.compile($("#error-message-tpl").html());
            }

            var message = compiledTemplate.warnInvalidForm({fields: invalidFields});
            var rendered = compiledTemplate.errorMessage({message: message});
            $("#signup-error").html(rendered);
            return false;
        } else {
            return true;
        }
    }
})();

$(function() {
    signup.init();
});
