Handlebars.registerHelper('moment', function(time) {
    var m = moment.unix(time);
    return new Handlebars.SafeString(m.format("LLLL"));
});
