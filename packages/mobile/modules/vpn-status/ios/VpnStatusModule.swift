import CFNetwork
import Darwin
import ExpoModulesCore
import Foundation

/**
 * Minimal iOS VPN probe — no NWPathMonitor observers (keep startup simple).
 */
public class VpnStatusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VpnStatus")

    Function("isVpnActive") { () -> Bool in
      Self.detect()
    }
  }

  static func detect() -> Bool {
    proxyIndicatesVpn() || interfaceIndicatesVpn() || proxyFlagsIndicateVpn()
  }

  private static func proxyIndicatesVpn() -> Bool {
    guard
      let unmanaged = CFNetworkCopySystemProxySettings(),
      let settings = unmanaged.takeRetainedValue() as? [String: Any],
      let scoped = settings["__SCOPED__"] as? [String: Any]
    else {
      return false
    }
    return scoped.keys.contains { isVpnInterfaceName($0) }
  }

  private static func proxyFlagsIndicateVpn() -> Bool {
    guard
      let unmanaged = CFNetworkCopySystemProxySettings(),
      let settings = unmanaged.takeRetainedValue() as? [String: Any]
    else {
      return false
    }
    let http = settings["HTTPEnable"] as? Int == 1
    let https = settings["HTTPSEnable"] as? Int == 1
    let socks = settings["SOCKSEnable"] as? Int == 1
    return http || https || socks
  }

  private static func interfaceIndicatesVpn() -> Bool {
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return false }
    defer { freeifaddrs(ifaddr) }

    var ptr: UnsafeMutablePointer<ifaddrs>? = first
    while let current = ptr {
      let flags = Int32(current.pointee.ifa_flags)
      let up = (flags & IFF_UP) != 0 && (flags & IFF_RUNNING) != 0
      let name = String(cString: current.pointee.ifa_name)
      if up, isVpnInterfaceName(name), let addr = current.pointee.ifa_addr {
        let family = Int32(addr.pointee.sa_family)
        if family == AF_INET || family == AF_INET6 {
          return true
        }
      }
      ptr = current.pointee.ifa_next
    }
    return false
  }

  private static func isVpnInterfaceName(_ raw: String) -> Bool {
    let name = raw.lowercased()
    return name.contains("tun")
      || name.contains("ipsec")
      || name.contains("ppp")
      || name.contains("tap")
      || name.contains("wg")
      || name.contains("ipip")
      || name.contains("pptp")
      || name.contains("l2tp")
  }
}
