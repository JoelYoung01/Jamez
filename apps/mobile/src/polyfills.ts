// Must be imported before anything from @jamez/core.
// - crypto.getRandomValues: required for key generation & join codes
// - TextEncoder/TextDecoder: Hermes gained these late; the shim no-ops when
//   the globals already exist.
import 'react-native-get-random-values'
import 'fast-text-encoding'
