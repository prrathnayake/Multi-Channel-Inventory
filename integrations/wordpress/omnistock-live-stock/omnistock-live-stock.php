<?php
/**
 * Plugin Name: OmniStock Live Stock
 * Description: Displays live stock from OmniStock on WooCommerce product pages.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) exit;

add_action('admin_menu', function() {
  add_options_page('OmniStock', 'OmniStock', 'manage_options', 'omnistock', 'omnistock_settings_page');
});

function omnistock_settings_page() {
  if (!current_user_can('manage_options')) return;
  if (isset($_POST['omnistock_url'])) {
    update_option('omnistock_url', esc_url_raw($_POST['omnistock_url']));
    update_option('omnistock_tenant', sanitize_text_field($_POST['omnistock_tenant']));
    echo '<div class="updated"><p>Saved</p></div>';
  }
  $url = esc_attr(get_option('omnistock_url', 'http://localhost:8080'));
  $tenant = esc_attr(get_option('omnistock_tenant', 'demo'));
  echo '<div class="wrap"><h1>OmniStock Settings</h1>
    <form method="post">
      <label>API URL <input name="omnistock_url" type="text" value="'.$url.'" class="regular-text"/></label><br/>
      <label>Tenant <input name="omnistock_tenant" type="text" value="'.$tenant.'" class="regular-text"/></label><br/>
      <p><button class="button button-primary">Save</button></p>
    </form></div>';
}

add_action('woocommerce_single_product_summary', function() {
  global $product;
  if (!$product) return;
  $sku = $product->get_sku();
  $url = get_option('omnistock_url', 'http://localhost:8080');
  $tenant = get_option('omnistock_tenant', 'demo');
  $loc = 'WH1';
  $endpoint = trailingslashit($url)."v1/tenants/{$tenant}/stock?sku={$sku}&location={$loc}";
  $resp = wp_remote_get($endpoint, ['timeout' => 5]);
  if (is_wp_error($resp)) return;
  $body = wp_remote_retrieve_body($resp);
  $data = json_decode($body, true);
  if (!$data) return;
  $avail = isset($data['available']) ? intval($data['available']) : 0;
  echo '<p><strong>Stock:</strong> '. esc_html($avail) .'</p>';
}, 25);
