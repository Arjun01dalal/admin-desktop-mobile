package expo.modules.vpnstatus

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Minimal VPN probe — no network callbacks (those were crashing some devices
 * when events fired off the main thread during startup).
 */
class VpnStatusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VpnStatus")

    Function("isVpnActive") {
      try {
        val context = appContext.reactContext
          ?: appContext.currentActivity
          ?: return@Function false
        isVpnActive(context)
      } catch (_: Exception) {
        false
      }
    }
  }

  private fun isVpnActive(context: Context): Boolean {
    val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE)
      as? ConnectivityManager ?: return false

    val hasVpnTransport = cm.allNetworks.any { network ->
      cm.getNetworkCapabilities(network)?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
    }
    if (hasVpnTransport) return true

    val activeHasVpn = cm.activeNetwork?.let { network ->
      cm.getNetworkCapabilities(network)?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
    } == true
    if (activeHasVpn) return true

    @Suppress("DEPRECATION")
    return try {
      cm.getNetworkInfo(ConnectivityManager.TYPE_VPN)?.isConnectedOrConnecting == true
    } catch (_: Exception) {
      false
    }
  }
}
