/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "./languageHandler";

export function levelRoleMap(usersDefault: number): Record<number | "undefined", string> {
    // Verji change map to use Verji translations for Role mapping
    return {
        undefined: _t("power_level|default"),
        0: _t("verji|power_level|standard"),
        [usersDefault]: _t("verji|power_level|default"),
        50: _t("verji|power_level|moderator"),
        80: _t("verji|power_level|admin"),
        90: _t("verji|power_level|tenant"),
        95: _t("verji|power_level|verji"),
        100: _t("verji|power_level|system"),
    };
}

export function textualPowerLevel(level: number, usersDefault: number): string {
    const LEVEL_ROLE_MAP = levelRoleMap(usersDefault);
    if (LEVEL_ROLE_MAP[level]) {
        return LEVEL_ROLE_MAP[level];
    } else {
        return _t("power_level|custom", { level });
    }
}
