// Same-origin FastAPI endpoints: the UserSync Space frontend is served by
// this repo's backend (backend/app/routers/usersync_compat.py), so every
// call below lands on our own /api/v1 + /api/tabs compat pack — no upstream
// proxy, no external Space.
const API_BASE_URL = "";

export class GradioService {
  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  static async identifyPersonas(context: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tabs/identify-personas/run`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ context })
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error("Error identifying personas:", error);
      return context;
    }
  }

  static async startSimulationAsync(simulationId: string, contentText: string, format: string = "text") {
    try {
      // simulationId is the focus-group id (or display name; the backend
      // resolves either and falls back to the latest generated group).
      const payload = {
        focus_group_id: simulationId,
        content_type: format,
        content_payload: contentText,
        parameters: {}
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/simulations`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.job_id;
    } catch (error) {
      console.error("Error starting simulation:", error);
      throw error;
    }
  }

  static async getSimulationStatus(jobId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/simulations/${jobId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting simulation status:", error);
      throw error;
    }
  }

  static async generateVariants(contentText: string, numVariants: number = 3) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tabs/variants/run`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ content_text: contentText, num_variants: numVariants })
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      return (data.result?.variants || []).map((v: any) => v.content);
    } catch (error) {
      console.error("Error generating variants:", error);
      return ["Variant generation failed."];
    }
  }

  static async listSimulations() {
    try {
      // Focus groups double as simulation targets.
      const response = await fetch(`${API_BASE_URL}/api/v1/personas`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.focus_groups || [];
    } catch (error) {
      console.error("Error listing simulations/personas:", error);
      return [];
    }
  }

  static async generatePersonas(businessDescription: string, customerProfile: string, numPersonas: number = 1) {
    try {
      const payload = {
        business_description: businessDescription,
        customer_profile: customerProfile,
        num_personas: numPersonas
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/personas/generate`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error generating personas:", error);
      throw error;
    }
  }

  static async generateSocialNetwork(name: string, personaCount: number = 10, networkType: string = "scale_free", focusGroupName: string | null = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tabs/social-network/run`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ name, persona_count: personaCount, network_type: networkType, focus_group_name: focusGroupName })
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error("Error generating social network:", error);
      return { status: "Network request failed" };
    }
  }

  static async getNetworkGraph(simulationId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/network/${encodeURIComponent(simulationId)}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn("getNetworkGraph failed:", error);
      return null;
    }
  }
}
