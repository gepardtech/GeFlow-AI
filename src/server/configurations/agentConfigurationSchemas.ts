/**
 * GeFlow AI — Agent Configuration Schemas (Step 12)
 *
 * Implements the Common Base Configuration Schema and the 29 canonical
 * agent-specific schemas with domain parameters, validation rules,
 * field protections, and compatibility specifications.
 */

import { AgentConfigurationSchema } from "./agentConfigurationTypes";
import { CANONICAL_29_AGENTS } from "../agents/canonicalAgentsData";

export const COMMON_BASE_SCHEMA_VERSION = "1.0.0";

/**
 * Common Base Configuration Schema applicable across all agents.
 */
export const COMMON_BASE_CONFIGURATION_SCHEMA: AgentConfigurationSchema = {
  schema_id: "schema_base_common_v1_0_0",
  schema_version: COMMON_BASE_SCHEMA_VERSION,
  agent_id: "*",
  required_fields: [
    "identity.agent_id",
    "identity.agent_name",
    "identity.primary_category_id",
    "identity.configuration_version",
    "identity.contract_version",
    "general.display_name",
    "general.enabled_status",
    "behavior.response_style",
    "behavior.response_detail_level",
    "execution.execution_timeout",
  ],
  optional_fields: [
    "general.supported_languages",
    "general.default_locale",
    "general.timezone_behavior",
    "behavior.task_handling_preferences",
    "behavior.confirmation_behavior",
    "behavior.error_handling_preferences",
    "capabilities.disabled_capabilities",
    "tools.restricted_tool_ids",
    "agent_specific_parameters",
  ],
  field_definitions: {
    "identity.agent_id": {
      field_name: "agent_id",
      type: "string",
      description: "Permanent canonical agent ID",
      required: true,
      is_protected: true,
    },
    "identity.primary_category_id": {
      field_name: "primary_category_id",
      type: "string",
      description: "Primary assigned category ID",
      required: true,
      is_protected: true,
    },
    "identity.contract_version": {
      field_name: "contract_version",
      type: "string",
      description: "Standardized contract version supported",
      required: true,
      is_protected: true,
    },
    "general.display_name": {
      field_name: "display_name",
      type: "string",
      description: "Human-readable display name of agent",
      required: true,
      min_length: 2,
      max_length: 100,
    },
    "general.enabled_status": {
      field_name: "enabled_status",
      type: "boolean",
      description: "Whether agent configuration is enabled",
      required: true,
      default_value: true,
    },
    "behavior.response_style": {
      field_name: "response_style",
      type: "string",
      description: "Tone and output formatting of agent",
      required: true,
      allowed_values: ["concise", "detailed", "analytical", "instructional"],
      default_value: "analytical",
    },
    "behavior.response_detail_level": {
      field_name: "response_detail_level",
      type: "string",
      description: "Level of granularity in agent reporting",
      required: true,
      allowed_values: ["summary", "standard", "exhaustive"],
      default_value: "standard",
    },
    "execution.execution_timeout": {
      field_name: "execution_timeout",
      type: "number",
      description: "Maximum execution runtime in milliseconds",
      required: true,
      min_value: 3000,
      max_value: 120000,
      default_value: 30000,
    },
  },
  validation_rules: {
    min_execution_timeout_ms: 3000,
    max_execution_timeout_ms: 120000,
    disallowed_override_fields: [
      "identity.agent_id",
      "identity.primary_category_id",
      "identity.contract_version",
      "identity.agent_type",
      "capabilities.enabled_capabilities", // cannot add capabilities via override
      "tools.allowed_tool_ids", // cannot add tools via override
    ],
  },
  default_values: {
    "general.supported_languages": ["en", "fr", "ur", "hi"],
    "general.default_locale": "en-US",
    "general.timezone_behavior": "business_local",
    "behavior.response_style": "analytical",
    "behavior.response_detail_level": "standard",
    "behavior.task_handling_preferences": {
      auto_execute_read_only: true,
      require_confirmation_for_write: true,
      strict_schema_enforcement: true,
    },
    "behavior.confirmation_behavior": "always_confirm_high_risk",
    "behavior.error_handling_preferences": {
      retry_transient_failures: true,
      fallback_to_safe_mode: true,
      expose_internal_traces: false,
    },
    "execution.execution_timeout": 30000,
    "execution.retry_policy_reference": "standard_exponential",
    "execution.concurrency_policy_reference": "sequential",
    "execution.approval_policy_reference": "gateway_risk_tier",
    "execution.execution_mode": "standard",
    "context.organization_context_policy": "strict_tenant_isolation",
    "context.category_context_policy": "strict_category_boundary",
    "context.data_access_scope": "business_operational_only",
    "context.context_visibility_rules": {
      allow_cross_location: false,
      allow_historical_lookback_days: 90,
    },
  },
  compatibility_rules: {
    minimum_contract_version: "1.0",
  },
  schema_status: "active",
  created_at: "2026-11-04T00:00:00Z",
};

/**
 * Domain-specific configuration parameter keys for each of the 29 canonical agents.
 */
const AGENT_SPECIFIC_DOMAIN_PARAMS: Record<string, Record<string, any>> = {
  "AGT-001": {
    department_reorder_multiplier: 1.15,
    enable_seasonal_markdown_alerts: true,
    pos_promotion_audit_depth: 10,
  },
  "AGT-002": {
    fertilizer_expiry_warning_days: 45,
    enable_bulk_uom_conversion: true,
    farmer_credit_khata_limit: 50000,
  },
  "AGT-003": {
    case_pack_breakage_tolerance: 0.02,
    b2b_invoice_credit_terms_days: 30,
    tier_discount_minimum_order: 100,
  },
  "AGT-004": {
    lens_prescription_axis_validation: true,
    frame_face_fit_metrics_enabled: true,
    optical_warranty_tracking_months: 12,
  },
  "AGT-005": {
    pet_vaccine_batch_shelf_life_days: 30,
    vet_prescription_vetting_required: true,
    live_animal_handling_protocol: "humane_certified",
  },
  "AGT-006": {
    equipment_serial_number_mandatory: true,
    gym_warranty_maintenance_interval_days: 90,
    fitness_bundle_pricing_rules: "active",
  },
  "AGT-007": {
    voltage_compatibility_warning: true,
    extended_warranty_duration_years: 2,
    home_delivery_schedule_window_hours: 4,
  },
  "AGT-008": {
    flatpack_assembly_service_default: true,
    timber_certification_check: true,
    warehouse_cube_utilization_target: 0.85,
  },
  "AGT-009": {
    gold_karat_hallmark_validation: true,
    gemstone_carat_certification_mandatory: true,
    daily_precious_metal_rate_sync: true,
  },
  "AGT-010": {
    isbn_13_checksum_validation: true,
    academic_term_back_to_school_reorder: true,
    publisher_return_credit_window_days: 60,
  },
  "AGT-011": {
    stylist_chair_commission_rate: 0.4,
    appointment_no_show_buffer_minutes: 15,
    consumable_chemical_batch_audit: true,
  },
  "AGT-012": {
    dermatological_patch_test_warning: true,
    hypoallergenic_tag_validation: true,
    tester_cosmetic_write_off_limit: 5,
  },
  "AGT-013": {
    vin_vehicle_lookup_enabled: true,
    technician_labor_rate_hourly: 65,
    preventive_oil_change_interval_km: 5000,
  },
  "AGT-014": {
    oem_vs_aftermarket_part_flag: true,
    core_deposit_charge_enabled: true,
    interchange_cross_reference_depth: 3,
  },
  "AGT-015": {
    pipe_diameter_unit_metric: true,
    brass_fittings_pressure_rating_psi: 150,
    contractor_bulk_pipe_discount: 0.12,
  },
  "AGT-016": {
    led_lumens_efficiency_check: true,
    wire_gauge_amp_safety_margin: 0.2,
    industrial_switchgear_certification: true,
  },
  "AGT-017": {
    cement_curing_batch_shelf_life_days: 60,
    steel_rebar_weight_per_meter_table: "standard_astm",
    hazardous_solvent_flammability_warning: true,
  },
  "AGT-018": {
    daily_dough_proofing_schedule_hours: 6,
    bakery_expiry_hours_from_bake: 24,
    cake_custom_decoration_lead_hours: 48,
  },
  "AGT-019": {
    coffee_roast_date_freshness_window_days: 21,
    dairy_alternative_milk_surcharge: 0.5,
    barista_speed_of_service_target_seconds: 90,
  },
  "AGT-020": {
    fryer_oil_test_frequency_hours: 12,
    drive_thru_order_target_seconds: 180,
    combo_meal_auto_upsell: true,
  },
  "AGT-021": {
    table_turnover_target_minutes: 60,
    kitchen_display_kot_routing_enabled: true,
    alcohol_beverage_age_verification_prompt: true,
  },
  "AGT-022": {
    shoe_size_width_standard: "us_eu_uk",
    left_right_shoe_pairing_check: true,
    footwear_box_barcode_mandatory: true,
  },
  "AGT-023": {
    apparel_size_matrix: ["XS", "S", "M", "L", "XL", "XXL"],
    garment_fabric_care_label_required: true,
    seasonal_clothing_clearance_discount: 0.3,
  },
  "AGT-024": {
    pc_component_compatibility_check: true,
    ram_ddr_bus_speed_match: true,
    rma_component_warranty_serial_tracking: true,
  },
  "AGT-025": {
    imei_esn_serial_mandatory: true,
    sim_carrier_lock_status_audit: true,
    trade_in_device_diagnostic_flow: "standard",
  },
  "AGT-026": {
    lithium_battery_shipping_compliance: true,
    refurbished_grade_classification: ["Grade A", "Grade B", "Grade C"],
    firmware_update_check_enabled: true,
  },
  "AGT-027": {
    produce_ripeness_shelf_life_days: 4,
    cold_chain_dairy_temp_celsius_max: 4,
    bag_recycling_tax_calculation: true,
  },
  "AGT-028": {
    pallet_intake_cross_docking_enabled: true,
    shrinkage_loss_prevention_alert_pct: 0.015,
    fmcg_fast_mover_reorder_days: 2,
  },
  "AGT-029": {
    prescription_rx_validation_mandatory: true,
    controlled_substance_schedule_check: true,
    drug_interaction_contraindication_alert: true,
    batch_expiry_quarantine_days: 90,
  },
};

/**
 * Builds the complete dictionary of 29 Agent-Specific Configuration Schemas.
 */
export function buildCanonicalAgentSchemas(): Map<string, AgentConfigurationSchema> {
  const schemaMap = new Map<string, AgentConfigurationSchema>();

  // Base schema
  schemaMap.set("*", COMMON_BASE_CONFIGURATION_SCHEMA);

  for (const agent of CANONICAL_29_AGENTS) {
    const domainParams = AGENT_SPECIFIC_DOMAIN_PARAMS[agent.agent_id] || {};

    const schema: AgentConfigurationSchema = {
      schema_id: `schema_${agent.agent_id.toLowerCase()}_v1_0_0`,
      schema_version: COMMON_BASE_SCHEMA_VERSION,
      agent_id: agent.agent_id,
      primary_category_id: agent.standard_category_id,
      required_fields: [
        ...COMMON_BASE_CONFIGURATION_SCHEMA.required_fields,
      ],
      optional_fields: [
        ...COMMON_BASE_CONFIGURATION_SCHEMA.optional_fields,
        ...Object.keys(domainParams).map((k) => `agent_specific_parameters.${k}`),
      ],
      field_definitions: {
        ...COMMON_BASE_CONFIGURATION_SCHEMA.field_definitions,
        ...Object.fromEntries(
          Object.entries(domainParams).map(([k, val]) => [
            `agent_specific_parameters.${k}`,
            {
              field_name: k,
              type: typeof val === "number" ? "number" : typeof val === "boolean" ? "boolean" : "string",
              description: `Domain parameter for ${agent.name}: ${k}`,
              required: false,
              default_value: val,
            },
          ])
        ),
      },
      validation_rules: {
        min_execution_timeout_ms: 3000,
        max_execution_timeout_ms: 120000,
        disallowed_override_fields: [
          ...COMMON_BASE_CONFIGURATION_SCHEMA.validation_rules.disallowed_override_fields,
        ],
      },
      default_values: {
        ...COMMON_BASE_CONFIGURATION_SCHEMA.default_values,
        "general.display_name": agent.name,
        "general.description": agent.description,
        agent_specific_parameters: domainParams,
      },
      compatibility_rules: {
        minimum_contract_version: "1.0",
      },
      schema_status: "active",
      created_at: "2026-11-04T00:00:00Z",
    };

    schemaMap.set(agent.agent_id, schema);
  }

  return schemaMap;
}

export const CANONICAL_AGENT_SCHEMAS = buildCanonicalAgentSchemas();
