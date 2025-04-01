function toggleWidget() {
    var iframe = document.getElementById("widget-frame");
    if (iframe) {
        FreshworksWidget("close");
    } else {
        FreshworksWidget("open");
        // Verji - give the widget a small headstart before we attempt to target and change css.
        setTimeout(attachCustomCss, 100);
    }
}
function init() {
    window.fwSettings = {
        widget_id: 80000004505,
        locale: "nb-NO",
    };
    !(function () {
        if ("function" != typeof window.FreshworksWidget) {
            var n = function () {
                n.q.push(arguments);
            };
            (n.q = []), (window.FreshworksWidget = n);
        }
    })();
    FreshworksWidget("hide", "launcher");
}
// Attaches som custom css to the support help widget (change banner color to verji-green)
function attachCustomCss() {
    console.log("[Verji] - Support Widget: Attempting to add custom css");
    var iframe = document.getElementById("widget-frame");
    var iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    if (iframeDocument) {
        const style = document.createElement("style");

        style.innerHTML = `
            .dTKHQv {
                background: rgba(91,150,28,1);
            }
        `;
        iframeDocument.head.appendChild(style);
        var widgetHeader = iframeDocument.getElementsByClassName("dTKHQv")[0];
        if (widgetHeader) {
            widgetHeader.setAttribute("id", "verji-support-header");
        }
    }
}
init();
export default toggleWidget;
