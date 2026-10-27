sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, MessageBox, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("psa.billing.controller.App", {
    onInit: function () {
      this._searchText = "";
      this._loadInvoices();
    },

    _loadInvoices: function () {
      var oTable = this.byId("invoiceTable");
      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        var oTemplate = oTable.getItems()[0].clone();
        oTable.bindItems({
          path: "/Invoices",
          parameters: {
            $select: "ID,invoice_number,client_name_snapshot,project_name_snapshot,invoice_date,due_date,period_from,period_to,billable_hours,subtotal_amt,tax_amt,tax_rate,total_amt,currency_code,payment_status,issued_at,immutable_on_issue"
          },
          template: oTemplate
        });
        oBinding = oTable.getBinding("items");
      }
      if (oBinding) {
        var aFilters = [];
        if (this._searchText) {
          aFilters.push(new Filter({
            filters: [
              new Filter("invoice_number", FilterOperator.Contains, this._searchText),
              new Filter("project_name_snapshot", FilterOperator.Contains, this._searchText),
              new Filter("client_name_snapshot", FilterOperator.Contains, this._searchText)
            ],
            and: false
          }));
        }
        oBinding.filter(aFilters);
        oBinding.refresh();
      }
    },

    onSearch: function (oEvent) {
      this._searchText = oEvent.getParameter("newValue") || "";
      var oBinding = this.byId("invoiceTable").getBinding("items");
      if (oBinding) {
        var aFilters = this._searchText ? [new Filter({
          filters: [
            new Filter("invoice_number", FilterOperator.Contains, this._searchText),
            new Filter("project_name_snapshot", FilterOperator.Contains, this._searchText),
            new Filter("client_name_snapshot", FilterOperator.Contains, this._searchText)
          ],
          and: false
        })] : [];
        oBinding.filter(aFilters);
      }
    },

    onRefresh: function () {
      var oBinding = this.byId("invoiceTable").getBinding("items");
      if (oBinding) oBinding.refresh();
    },

    onSelectionChange: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (oItem && oItem.getBindingContext()) this._showInvoice(oItem.getBindingContext());
    },

    _showInvoice: async function (oContext) {
      try {
        var oDetails = this.byId("invoiceDetails");
        oDetails.setBindingContext(oContext);
        oDetails.setVisible(true);
        this.byId("selectionMessage").setVisible(false);
        var oLines = this.byId("invoiceLinesTable");
        oLines.setVisible(true);
        oLines.bindItems({
          path: oContext.getPath() + "/lines",
          template: oLines.getItems()[0].clone()
        });
      } catch (error) {
        MessageBox.error("Could not show invoice details. " + this._errorText(error));
      }
    },

    onDownloadPdf: async function () {
      var oItem = this.byId("invoiceTable").getSelectedItem();
      var oContext = oItem && oItem.getBindingContext();
      if (!oContext) {
        MessageToast.show("Select an invoice first.");
        return;
      }

      var oInvoice;
      try {
        oInvoice = await oContext.requestObject();
      } catch (error) {
        MessageBox.error("Could not read the selected invoice. " + this._errorText(error));
        return;
      }
      if (!oInvoice.invoice_number || !oInvoice.issued_at || !oInvoice.immutable_on_issue) {
        MessageBox.warning("Only issued invoices can be downloaded as a PDF.");
        return;
      }

      var oButton = this.byId("downloadButton");
      oButton.setBusy(true);
      try {
        var oAction = this.getView().getModel().bindContext("/downloadInvoicePdf(...)");
        oAction.setParameter("invoiceID", oInvoice.ID);
        await oAction.execute();
        var oResultContext = oAction.getBoundContext();
        var vResult = oResultContext && await oResultContext.requestObject();
        var sBase64 = typeof vResult === "string" ? vResult :
          (vResult && (vResult.value || vResult.downloadInvoicePdf || vResult.$value));
        if (!sBase64) {
          throw new Error("The response did not contain PDF data in the expected format.");
        }

        var aBytes = this._base64ToBytes(sBase64);
        var oBlob = new Blob([aBytes], { type: "application/pdf" });
        var sUrl = URL.createObjectURL(oBlob);
        var oLink = document.createElement("a");
        oLink.href = sUrl;
        oLink.download = oInvoice.invoice_number + ".pdf";
        document.body.appendChild(oLink);
        oLink.click();
        oLink.remove();
        URL.revokeObjectURL(sUrl);
        MessageToast.show("PDF download started.");
      } catch (error) {
        MessageBox.error("PDF download failed. " + this._errorText(error));
      } finally {
        oButton.setBusy(false);
      }
    },

    _base64ToBytes: function (sBase64) {
      var sClean = String(sBase64).replace(/^data:application\/pdf;base64,/, "");
      var sBinary = atob(sClean);
      var aBytes = new Uint8Array(sBinary.length);
      for (var i = 0; i < sBinary.length; i += 1) aBytes[i] = sBinary.charCodeAt(i);
      return aBytes;
    },

    _errorText: function (error) {
      return error && error.message ? error.message : String(error || "Unknown error");
    },

    formatStatusState: function (sStatus) {
      switch (sStatus) {
        case "Paid": return "Success";
        case "Overdue": return "Error";
        case "Issued": return "Information";
        case "Draft": return "Warning";
        case "Cancelled": return "None";
        default: return "None";
      }
    },

    formatPeriod: function (sFrom, sTo) {
      if (!sFrom && !sTo) return "—";
      return (sFrom || "—") + " to " + (sTo || "—");
    }
  });
});
