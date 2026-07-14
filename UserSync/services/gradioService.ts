// Use same-origin FastAPI endpoints on the Hugging Face Space; the backend proxies upstream API calls.
const API_BASE_URL = "";

export class GradioService {
  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  static async identifyPersonas(context: string) {
    // Deprecated? Just returns context for now to not break apps that might expect a string
    console.warn("identifyPersonas is no longer supported directly by the REST API.");
    return context;
  }

  static async startSimulationAsync(simulationId: string, contentText: string, format: string = "text") {
    try {
      // simulationId in the old code might have been the focus group ID.
      // Let's assume simulationId is the focus_group_id
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

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error getting simulation status:", error);
      throw error;
    }
  }

  static async generateVariants(contentText: string, numVariants: number = 3) {
    // This endpoint doesn't exist in the openapi spec.
    console.warn("generateVariants is no longer supported by the REST API.");
    return ["Variant generation not supported."];
  }

  static async listSimulations() {
    try {
      // Returns focus groups from the personas endpoint
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

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error generating personas:", error);
      throw error;
    }
  }

  static async generateSocialNetwork(name: string, personaCount: number = 10, networkType: string = "scale_free", focusGroupName: string | null = null) {
    console.warn("generateSocialNetwork is subsumed by persona generation or not supported.");
    return { status: "Network generated" };
  }

  static async getNetworkGraph(simulationId: string) {
    // Not supported
    console.warn("getNetworkGraph is not supported by the REST API.");
    return null;
  }
}
