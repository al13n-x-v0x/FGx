'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const antispam = require('./antispam');
const antiraid = require('./antiraid');
const antinuke = require('./antinuke');
const lockdown = require('./lockdown');

module.exports = { antispam, antiraid, antinuke, lockdown };
