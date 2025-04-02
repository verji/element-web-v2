/**
 * Copyright Verji Tech AS 2025
 * Custom code to render support button
 */
import { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";
import HelpIcon from "@vector-im/compound-design-tokens/assets/web/icons/help";
import React from "react";

// @ts-ignore
import toggleWidget from "../components/structures/scripts/freshworks.js";
import { _t } from "../languageHandler";

const verjiRoomHeaderOpts: ViewRoomOpts = {
    buttons: [
        {
            icon: () => <HelpIcon />,
            id: "verjiSupport",
            label: () => _t("common|support"),
            onClick: () => {
                openSupportDialog();
            },
        },
    ],
};

function openSupportDialog(): void {
    toggleWidget();
}

export default verjiRoomHeaderOpts;
