/** Cordis plugin id and shared runtime identifiers. */
export const PLUGIN_NAME = 'wx-clawbot'

/** Default DSH credential ref for the paired iLink bot token. */
export const DEFAULT_CREDENTIAL_REF = 'WX_CLAWBOT_BOT_TOKEN'

/** Prefix for DSH Session ids created by this bridge. */
export const SESSION_ID_PREFIX = 'wx-clawbot-'

/** Legacy session prefixes from earlier plugin ids. */
export const LEGACY_SESSION_ID_PREFIXES = ['weixin-', 'dsh-wx-clawbot-']

/** HTTP path prefix for QR pairing pages served during setup. */
export const QR_ROUTE_PREFIX = '/wx-clawbot'

export const QR_IMAGE_PATH = `${QR_ROUTE_PREFIX}/pairing-qr.png`
export const QR_PAGE_PATH = `${QR_ROUTE_PREFIX}/pairing`

/** Default HTTP port for temporary Weixin QR pairing during `wx-clawbot setup`. */
export const DEFAULT_QR_PORT = 3081
